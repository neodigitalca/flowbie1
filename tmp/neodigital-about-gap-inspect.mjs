import { callTool, openEmcp } from "./emcp-http.mjs";
import puppeteer from "puppeteer";

const IDS = ["5c4f099", "6fd735a", "6e9d357", "997322a", "ac794fe", "b104736"];
const session = await openEmcp("neo-pulse-about-gap-inspect");
let id = 2;
const settings = {};
for (const element_id of IDS) {
  const res = await callTool(
    session,
    "emcp-tools-get-element-settings",
    { post_id: 129, element_id },
    id++,
  );
  const s = res.data?.settings || {};
  settings[element_id] = {
    widget: res.data?.widgetType,
    min_height: s.min_height,
    min_height_tablet: s.min_height_tablet,
    height: s.height,
    padding: s.padding,
    padding_tablet: s.padding_tablet,
    margin: s.margin,
    flex_align_items: s.flex_align_items,
    grid_align_items: s.grid_align_items,
    container_type: s.container_type,
  };
}

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto(`https://neodigital.ca/about/?nonitro=1&v=gap-${Date.now()}`, {
  waitUntil: "networkidle2",
  timeout: 90000,
});
const live = await page.evaluate(() => {
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      h: Math.round(r.height),
      y: Math.round(r.y + window.scrollY),
      padT: cs.paddingTop,
      padB: cs.paddingBottom,
      minH: cs.minHeight,
      mh: cs.marginTop,
      mb: cs.marginBottom,
    };
  };
  const byId = (id) => document.querySelector(`[data-id="${id}"]`);
  return {
    hero: box(byId("5c4f099")),
    slider: box(byId("6fd735a")),
    intro: box(byId("6e9d357")),
    text: box(byId("997322a")),
    image: box(byId("ac794fe")),
    next: box(byId("b104736")),
  };
});
await browser.close();
process.stdout.write(`${JSON.stringify({ settings, live }, null, 2)}\n`);
