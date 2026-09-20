/**
 * Public list pull. Proxy required. GET only.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { openProxiedSession, proxiedGetText, sleep, writeGitignoredJson } from "./lib.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const dest = join(root, "test-output", "firstrank-inventory.json");
const ORIGIN = "https://www.firstrank.ca";
const PER_PAGE = 20;
const GAP_MS = 1100;

function listUrl(kind, page) {
  const path = kind === "posts" ? "/wp-json/wp/v2/posts" : "/wp-json/wp/v2/pages";
  return `${ORIGIN}${path}?per_page=${PER_PAGE}&page=${page}&_fields=id,link,slug,modified,title,date,type`;
}

function normalizeItem(row) {
  return {
    id: row.id,
    type: row.type,
    slug: row.slug,
    link: row.link,
    date: row.date || "",
    modified: row.modified || "",
    title: row.title?.rendered || row.title || "",
  };
}

async function pullKind(page, kind) {
  const items = [];
  let pageNo = 1;
  while (true) {
    const text = await proxiedGetText(page, listUrl(kind, pageNo));
    const rows = JSON.parse(text);
    if (!Array.isArray(rows) || rows.length === 0) break;
    items.push(...rows.map(normalizeItem));
    if (rows.length < PER_PAGE) break;
    pageNo += 1;
    await sleep(GAP_MS);
  }
  return items;
}

export async function runInventory() {
  const session = await openProxiedSession();
  try {
    const pages = await pullKind(session.page, "pages");
    await sleep(GAP_MS);
    const posts = await pullKind(session.page, "posts");
    const payload = { pages, posts };
    writeGitignoredJson(dest, payload);
    return { dest, pageCount: pages.length, postCount: posts.length };
  } finally {
    await session.browser.close();
  }
}

const invoked = process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("firstrank-teardown/inventory.mjs");
if (invoked) {
  runInventory()
    .then((r) => {
      process.stdout.write(`${r.pageCount} pages, ${r.postCount} posts\n`);
    })
    .catch((err) => {
      process.stderr.write(`${err instanceof Error ? err.message : err}\n`);
      process.exit(1);
    });
}
