import puppeteer from "puppeteer";
import { callTool, openEmcp } from "./emcp-http.mjs";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto(`https://neodigital.ca/about/?nonitro=1&v=empty-${Date.now()}`, {
  waitUntil: "networkidle2",
  timeout: 90000,
});

const live = await page.evaluate(() => {
  const cons = [...document.querySelectorAll(".e-con, .elementor-element.e-con")];
  return cons.map((el) => {
    const widgets = el.querySelectorAll(":scope > .elementor-element.elementor-widget, :scope > .e-con-inner > .elementor-element");
    const kids = el.querySelectorAll(":scope > .elementor-element, :scope > .e-con-inner > .elementor-element");
    return {
      id: el.getAttribute("data-id"),
      widgets: widgets.length,
      kids: kids.length,
      empty: kids.length === 0,
    };
  });
});
await browser.close();

const empties = live.filter((c) => c.empty || c.widgets === 0 && c.kids === 0);
process.stdout.write(`${JSON.stringify({ empty: empties, all: live }, null, 2)}\n`);

if (empties.length) {
  const session = await openEmcp("neo-pulse-about-del-empty");
  let id = 2;
  const removed = [];
  for (const item of empties) {
    if (!item.id) continue;
    const res = await callTool(
      session,
      "emcp-tools-remove-element",
      { post_id: 129, element_id: item.id },
      id++,
    );
    removed.push({ id: item.id, ok: res.data?.success === true });
  }
  process.stdout.write(`${JSON.stringify({ removed }, null, 2)}\n`);
}
