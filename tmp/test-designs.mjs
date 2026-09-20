import { callTool, openEmcp } from "./emcp-http.mjs";
import puppeteer from "puppeteer";

const session = await openEmcp("neo-pulse-test-designs");
const POST_ID = 10203;

// Add design-one
const d1 = await callTool(session, "emcp-tools-add-free-widget", {
  post_id: POST_ID,
  parent_id: "4c1e062",
  widget_type: "ygency-feature-box",
  position: 0,
  settings: {
    box_design: "design-one",
    box_index: "01",
    box_title: "Local keyword research",
    box_desc: "We map the Edmonton SEO queries your buyers type, then assign them to the pages that can rank and convert.",
    read_more_text: ""
  }
}, 1);

// Add design-two
const d2 = await callTool(session, "emcp-tools-add-free-widget", {
  post_id: POST_ID,
  parent_id: "4c1e062",
  widget_type: "ygency-feature-box",
  position: 1,
  settings: {
    box_design: "design-two",
    box_index: "01",
    box_title: "Local keyword research",
    box_desc: "We map the Edmonton SEO queries your buyers type, then assign them to the pages that can rank and convert.",
    read_more_text: ""
  }
}, 2);

console.log("Added d1:", d1.data?.element_id, "d2:", d2.data?.element_id);

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const html = await page.evaluate((ids) => {
  return ids.map(id => {
    const el = document.querySelector(`.elementor-element-${id}`);
    return el ? el.outerHTML : null;
  });
}, [d1.data?.element_id, d2.data?.element_id]);

console.log("HTML D1:", html[0]);
console.log("HTML D2:", html[1]);

// Cleanup
await callTool(session, "emcp-tools-remove-element", { post_id: POST_ID, element_id: d1.data?.element_id }, 3);
await callTool(session, "emcp-tools-remove-element", { post_id: POST_ID, element_id: d2.data?.element_id }, 4);

await browser.close();
