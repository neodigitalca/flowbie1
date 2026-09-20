import { callTool, openEmcp } from "./emcp-http.mjs";
import puppeteer from "puppeteer";

const session = await openEmcp("neo-pulse-test-fbox");
const POST_ID = 10203;

// Let's add a test ygency-feature-box to 4c1e062 to see how it renders!
const addRes = await callTool(session, "emcp-tools-add-free-widget", {
  post_id: POST_ID,
  parent_id: "4c1e062",
  widget_type: "ygency-feature-box",
  position: 0,
  settings: {
    box_design: "design-three",
    box_index: "01",
    box_title: "Local keyword research",
    box_desc: "We map the Edmonton SEO queries your buyers type, then assign them to the pages that can rank and convert.",
    read_more_text: ""
  }
}, 1);

console.log("ADD FBOX RESULT:", addRes.data);

// Inspect live page with Puppeteer
const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const rowRect = await page.evaluate(() => {
  const el = document.querySelector(".elementor-element-4c1e062");
  if (!el) return null;
  el.scrollIntoView({ block: "center" });
  return el.getBoundingClientRect();
});

await new Promise(r => setTimeout(r, 800));
await page.screenshot({ path: "tmp/test-fbox-render.png" });
await browser.close();
console.log("Screenshot saved to tmp/test-fbox-render.png");
