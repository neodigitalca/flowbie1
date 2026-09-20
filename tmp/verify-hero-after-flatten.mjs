import { callTool, openEmcp } from "./emcp-http.mjs";
import puppeteer from "puppeteer";

const session = await openEmcp("neo-verify-hero");
const struct = await callTool(session, "emcp-tools-get-page-structure", { post_id: 10203, max_depth: 10 }, 1);

function findNode(nodes, id) {
  for (const n of nodes || []) {
    if (n.id === id) return n;
    const f = findNode(n.elements, id);
    if (f) return f;
  }
  return null;
}

const s980 = findNode(struct.data?.structure, "9806fc2");
console.log("9806fc2 children:", s980?.elements?.map((e) => ({ id: e.id, type: e.widgetType || e.elType, title: e.settings_summary?.title })));

const e8 = findNode(struct.data?.structure, "e8af43f");
console.log("e8af43f children:", e8?.elements?.map((e) => ({ id: e.id, type: e.widgetType, title: e.settings_summary?.title })));

const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2", timeout: 90000 });
await page.evaluate(() => document.querySelector(".elementor-element-afa170d")?.scrollIntoView());
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: "tmp/hero-after-flatten.png" });
const h1 = await page.evaluate(() => document.querySelector(".elementor-element-2bbef65")?.innerText);
console.log("H1 visible:", h1);
await browser.close();
