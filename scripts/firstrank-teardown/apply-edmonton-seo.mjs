/**
 * Apply Edmonton SEO proof + schema on neodigital.ca page 10203.
 * WordPress application password over REST through the residential proxy. No OAuth.
 */
import { readFileSync } from "node:fs";
import { runNeodigitalPhp } from "../edmonton-internal-links/sftp-oneshot.mjs";
import { openProxiedSession } from "./lib.mjs";

const POST_ID = 10203;
const ORIGIN = "https://neodigital.ca";
const OLD_TAIL = "case study.";
const NEW_TAIL =
  "case study: site clicks 4,066 to 11,382, impressions 460k to 1.16M, average position 31.5 to 20.0.";
const OLD_METRO =
  "Downtown, Whyte Avenue, West Edmonton, St. Albert, Sherwood Park, Leduc, Spruce Grove, and Nisku.";
const NEW_METRO =
  "Downtown, Whyte Avenue, West Edmonton, Stony Plain, St. Albert, Sherwood Park, Leduc, Beaumont, Spruce Grove, and Nisku.";

const SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ProfessionalService",
      name: "Neo Digital",
      url: "https://neodigital.ca/",
      telephone: "+1-587-416-4130",
      email: "info@neodigital.ca",
      areaServed: { "@type": "City", name: "Edmonton" },
      address: {
        "@type": "PostalAddress",
        addressLocality: "Edmonton",
        addressRegion: "AB",
        addressCountry: "CA",
      },
      serviceType: "Edmonton SEO",
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Edmonton SEO?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Edmonton SEO is local search work built for this city. It covers Google Business Profile, the local pack, on-page copy, and the service pages Edmonton buyers open before they call.",
          },
        },
        {
          "@type": "Question",
          name: "How is Edmonton SEO different from national SEO?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "National SEO chases broad queries. Edmonton SEO ranks the city and neighborhood searches that send jobs to a local business, including maps and reviews.",
          },
        },
        {
          "@type": "Question",
          name: "How long does Edmonton SEO take to move rankings?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Most programs show early Google Business Profile and on-page movement in the first weeks. Competitive local pack terms usually take a few months of consistent work.",
          },
        },
        {
          "@type": "Question",
          name: "How much does Edmonton SEO cost?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Typical Edmonton retainers we see in this market sit between $1,500 and $3,500 a month. We scope the program to your competition and page set.",
          },
        },
        {
          "@type": "Question",
          name: "Why is my competitor in the map pack and I am not?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Map pack ranks on proximity, relevance, and prominence. Missing categories, stale Name Address Phone data, thin neighborhood copy, and slow review velocity are the usual gaps.",
          },
        },
        {
          "@type": "Question",
          name: "Can I run Edmonton SEO myself?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "You can claim the Google Business Profile, ask for reviews, and write service pages. Hire the program when technical crawl issues or competitive keywords stall that work.",
          },
        },
      ],
    },
  ],
};

function loadBasic() {
  const mcp = JSON.parse(readFileSync("C:/Users/Sean Craig/.cursor/mcp.json", "utf8"));
  const server = mcp.mcpServers["emcp-neodigital-ca"];
  if (!server?.headers?.Authorization?.startsWith("Basic ")) {
    throw new Error("emcp-neodigital-ca must use HTTP Basic application password");
  }
  return server.headers.Authorization;
}

async function wpGet(page, authorization, path) {
  await page.setExtraHTTPHeaders({
    Authorization: authorization,
    Accept: "application/json",
    "Accept-Language": "en-CA,en;q=0.9",
  });
  const res = await page.goto(`${ORIGIN}${path}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
    referer: "",
  });
  const text = await page.evaluate(() => document.body?.innerText ?? "");
  return { status: res?.status() ?? 0, text };
}

async function wpPost(page, authorization, path, body) {
  return page.evaluate(
    async ({ origin, path, authorization, body }) => {
      const res = await fetch(`${origin}${path}`, {
        method: "POST",
        headers: {
          Authorization: authorization,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      return { status: res.status, text: await res.text() };
    },
    { origin: ORIGIN, path, authorization, body },
  );
}

function walkProof(nodes) {
  let count = 0;
  if (!Array.isArray(nodes)) return 0;
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const settings = node.settings && typeof node.settings === "object" ? node.settings : {};
    for (const [key, val] of Object.entries(settings)) {
      if (typeof val !== "string" || !val.includes("Blind Magic") || !val.includes(OLD_TAIL)) continue;
      node.settings[key] = val.replace(OLD_TAIL, NEW_TAIL);
      count += 1;
    }
    if (Array.isArray(node.elements)) count += walkProof(node.elements);
  }
  return count;
}

function walkReplace(nodes, needle, replacement) {
  let count = 0;
  if (!Array.isArray(nodes)) return 0;
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const settings = node.settings && typeof node.settings === "object" ? node.settings : {};
    for (const [key, val] of Object.entries(settings)) {
      if (typeof val !== "string" || !val.includes(needle)) continue;
      node.settings[key] = val.replace(needle, replacement);
      count += 1;
    }
    if (Array.isArray(node.elements)) count += walkReplace(node.elements, needle, replacement);
  }
  return count;
}

function hasLd(nodes) {
  return JSON.stringify(nodes).includes("application/ld+json");
}

const authorization = loadBasic();
const session = await openProxiedSession();
try {
  const got = await wpGet(session.page, authorization, `/wp-json/wp/v2/pages/${POST_ID}?context=edit`);
  if (got.status !== 200) {
    throw new Error(`WP GET ${got.status}`);
  }
  const page = JSON.parse(got.text);
  const raw = page.meta?._elementor_data;
  if (!raw) {
    throw new Error("Page is missing _elementor_data");
  }
  const tree = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (!Array.isArray(tree)) {
    throw new Error("Elementor tree is not an array");
  }

  const replaced = walkProof(tree);
  if (replaced < 1 && !JSON.stringify(tree).includes("4,066")) {
    throw new Error("Blind Magic proof sentence missing");
  }
  const metro = JSON.stringify(tree).includes("Stony Plain")
    ? 0
    : walkReplace(tree, OLD_METRO, NEW_METRO);
  if (metro < 1 && !JSON.stringify(tree).includes("Stony Plain")) {
    throw new Error("Metro sentence missing");
  }

  const facts =
    "Edmonton SEO facts (September 2026): typical retainers sit between $1,500 and $3,500 a month. Google Business Profile and on-page work can move in the first weeks. Competitive local pack terms take a few months. Blind Magic site clicks went from 4,066 to 11,382, impressions 460,723 to 1,163,424, average position 31.5 to 20.0. Phoenix Painting: site clicks 129 to 282, impressions 42,500 to 73,986, average position 51.4 to 28.6. Neo Digital does not run a national city-SEO factory.";
  let factsAdded = 0;
  function walkFacts(nodes) {
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const settings = node.settings && typeof node.settings === "object" ? node.settings : {};
      for (const [key, val] of Object.entries(settings)) {
        if (typeof val !== "string") continue;
        if (val.includes("Edmonton SEO built for local search") && !val.includes("Edmonton SEO facts (September 2026)")) {
          node.settings[key] = `${val.trim()}\n\n${facts}`;
          factsAdded += 1;
        }
      }
      if (Array.isArray(node.elements)) walkFacts(node.elements);
    }
  }
  walkFacts(tree);

  let schemaAdded = false;
  if (!hasLd(tree)) {
    if (!tree[0] || !Array.isArray(tree[0].elements)) {
      throw new Error("Root container missing");
    }
    tree[0].elements.push({
      id: "ndschma",
      elType: "widget",
      widgetType: "html",
      settings: {
        html: `<script type="application/ld+json">${JSON.stringify(SCHEMA)}</script>`,
      },
      elements: [],
    });
    schemaAdded = true;
  }

  const posted = await wpPost(session.page, authorization, `/wp-json/wp/v2/pages/${POST_ID}`, {
    meta: { _elementor_data: JSON.stringify(tree) },
  });
  if (posted.status < 200 || posted.status >= 300) {
    throw new Error(`WP POST ${posted.status}`);
  }

  await runNeodigitalPhp(
    `
if ( class_exists( '\\Elementor\\Plugin' ) ) {
  \\Elementor\\Plugin::\$instance->files_manager->clear_cache();
}
echo wp_json_encode( array( 'ok' => true ) );
`,
    "nd-edmonton-seo-clear-cache",
  );

  const live = await session.page.goto(`${ORIGIN}/edmonton-seo/?nonitro=1`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
    referer: "",
  });
  const html = await session.page.content();
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      replaced,
      metro,
      schemaAdded,
      liveStatus: live?.status() ?? 0,
      liveFaq: html.includes("FAQPage"),
      liveService: html.includes("ProfessionalService"),
      liveProof: html.includes("4,066"),
      liveMetro: html.includes("Stony Plain") && html.includes("Beaumont"),
      factsAdded,
      liveFacts: html.includes("Edmonton SEO facts (September 2026)"),
      liveClinic: html.includes("Clinic owner"),
    })}\n`,
  );
} finally {
  await session.browser.close();
}
