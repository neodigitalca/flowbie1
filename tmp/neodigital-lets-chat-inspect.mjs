import { callTool, openEmcp } from "./emcp-http.mjs";
import puppeteer from "puppeteer";

const session = await openEmcp("neo-pulse-lets-chat-inspect");
let id = 2;

const buttons = await callTool(
  session,
  "emcp-tools-find-element",
  { post_id: 129, widget_type: "ygency-button" },
  id++,
);
const titles = await callTool(
  session,
  "emcp-tools-find-element",
  { post_id: 129, widget_type: "ygency-section-title" },
  id++,
);
const templates = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: 129, element_id: "5a94104" },
  id++,
);
const templates2 = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: 129, element_id: "8690a53" },
  id++,
);

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/about/?nonitro=1&v=chat1", {
  waitUntil: "networkidle2",
  timeout: 90000,
});
const live = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll("a, button, span, div")].filter((el) =>
    /let'?s chat/i.test((el.textContent || "").trim()) && (el.textContent || "").trim().length < 40,
  );
  return nodes.slice(0, 8).map((el) => {
    const r = el.getBoundingClientRect();
    return {
      text: (el.textContent || "").trim().slice(0, 40),
      tag: el.tagName,
      cls: el.className?.toString().slice(0, 120),
      id: el.closest("[data-id]")?.getAttribute("data-id"),
      href: el.getAttribute("href"),
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
    };
  });
});
await browser.close();

process.stdout.write(
  `${JSON.stringify(
    {
      buttons: buttons.data,
      titles: titles.data,
      t1: templates.data?.settings || templates.data,
      t2: templates2.data?.settings || templates2.data,
      live,
    },
    null,
    2,
  )}\n`,
);
