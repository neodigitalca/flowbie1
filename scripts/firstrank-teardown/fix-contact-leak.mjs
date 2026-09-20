/**
 * Restore the hero contact link and turn the footer "Contact us" into a real URL.
 * WordPress application password over REST through the residential proxy.
 */
import { readFileSync } from "node:fs";
import { runNeodigitalPhp } from "../edmonton-internal-links/sftp-oneshot.mjs";
import { openProxiedSession } from "./lib.mjs";

const POST_ID = 10203;
const ORIGIN = "https://neodigital.ca";
const CONTACT = "https://neodigital.ca/contact/";
const HERO_CONTACT = `<p><a href="${CONTACT}">contact Neo Digital</a> to start the Edmonton program.</p>`;
const HERO_PLAIN = "<p>contact Neo Digital to start the Edmonton program.</p>";

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
  return { status: res?.status() ?? 0, text: await page.evaluate(() => document.body?.innerText ?? "") };
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

function walk(nodes, fn) {
  if (!Array.isArray(nodes)) return;
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    fn(node);
    if (Array.isArray(node.elements)) walk(node.elements, fn);
  }
}

const authorization = loadBasic();
const session = await openProxiedSession();
try {
  const got = await wpGet(session.page, authorization, `/wp-json/wp/v2/pages/${POST_ID}?context=edit`);
  if (got.status !== 200) throw new Error(`WP GET ${got.status}`);
  const page = JSON.parse(got.text);
  const raw = page.meta?._elementor_data;
  if (!raw) throw new Error("Page is missing _elementor_data");
  const tree = typeof raw === "string" ? JSON.parse(raw) : raw;

  const report = { hero: "", title: "", subtitle: "" };
  walk(tree, (node) => {
    const settings = node.settings && typeof node.settings === "object" ? node.settings : {};
    if (node.id === "c28b26d" && typeof settings.editor === "string") {
      node.settings.editor = settings.editor.replaceAll("<p>contact Neo Digital</p>", "");
      if (!node.settings.editor.includes(`href="${CONTACT}"`)) {
        node.settings.editor = `${node.settings.editor.trimEnd()}${HERO_CONTACT}`;
      }
      report.hero = node.settings.editor.slice(-180);
    }
    if (node.id === "2789678") {
      delete node.settings.link;
      node.settings.subtitle = "Contact us";
      report.title = settings.title || "";
      report.subtitle = node.settings.subtitle;
    }
  });

  const posted = await wpPost(session.page, authorization, `/wp-json/wp/v2/pages/${POST_ID}`, {
    meta: { _elementor_data: JSON.stringify(tree) },
  });
  if (posted.status < 200 || posted.status >= 300) throw new Error(`WP POST ${posted.status}`);
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
  const text = await session.page.evaluate(() => document.body?.innerText ?? "");
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      ...report,
      liveStatus: live?.status() ?? 0,
      liveRawTag: text.includes('<a href="https://neodigital.ca/contact/">'),
      liveContactUs: text.includes("Contact us"),
      liveTellUs: text.includes("Tell us how Edmonton SEO should help"),
      liveHeroHref: html.includes(`href="${CONTACT}"`),
    })}\n`,
  );
} finally {
  await session.browser.close();
}
