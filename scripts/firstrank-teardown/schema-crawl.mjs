/**
 * Public HTML JSON-LD pull. Proxy required. GET only.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractJsonLd,
  jsonLdTypes,
  openProxiedSession,
  proxiedGetHtml,
  sleep,
  writeGitignoredJson,
} from "./lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const dest = join(root, "test-output", "firstrank-schema.json");
const inventoryPath = join(root, "test-output", "firstrank-inventory.json");
const GAP_MS = 1100;

const SEED = [
  "https://www.firstrank.ca/",
  "https://www.firstrank.ca/edmonton-seo/",
  "https://www.firstrank.ca/10-local-seo-tips-for-edmonton/",
  "https://www.firstrank.ca/gmb-for-edmonton-businesses/",
  "https://www.firstrank.ca/citations-for-businesses-in-edmonton/",
  "https://www.firstrank.ca/link-building-in-edmonton/",
  "https://www.firstrank.ca/content-generation-in-edmonton/",
  "https://www.firstrank.ca/small-business-marketing-in-edmonton/",
  "https://www.firstrank.ca/calgary-seo/",
  "https://www.firstrank.ca/winnipeg-seo/",
  "https://www.firstrank.ca/local-seo-guide/",
  "https://www.firstrank.ca/technical-seo-guide/",
];

function extraFromInventory() {
  try {
    const data = JSON.parse(readFileSync(inventoryPath, "utf8"));
    const rows = [...(data.pages || []), ...(data.posts || [])];
    return rows
      .filter((r) => String(r.slug || "").includes("edmonton") || String(r.link || "").includes("edmonton"))
      .map((r) => r.link)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function uniq(urls) {
  return [...new Set(urls.filter(Boolean))];
}

export async function runSchemaCrawl(urls = [...SEED, ...extraFromInventory()]) {
  const session = await openProxiedSession();
  try {
    const pages = [];
    const seen = new Set();
    for (const url of uniq(urls)) {
      if (seen.has(url)) continue;
      seen.add(url);
      const html = await proxiedGetHtml(session.page, url);
      const blocks = extractJsonLd(html);
      pages.push({
        url,
        types: jsonLdTypes(blocks),
        blockCount: blocks.filter((b) => !b?.invalid).length,
      });
      await sleep(GAP_MS);
    }
    const payload = { pages };
    writeGitignoredJson(dest, payload);
    return { dest, count: pages.length };
  } finally {
    await session.browser.close();
  }
}

const invoked = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("firstrank-teardown/schema-crawl.mjs");
if (invoked) {
  runSchemaCrawl()
    .then((r) => {
      process.stdout.write(`${r.count} pages\n`);
    })
    .catch((err) => {
      process.stderr.write(`${err instanceof Error ? err.message : err}\n`);
      process.exit(1);
    });
}
