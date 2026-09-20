import { callTool, openEmcp } from "./emcp-http.mjs";
import puppeteer from "puppeteer";

const POST_ID = 131;
const session = await openEmcp("neo-pulse-services-page-inspect");
let id = 2;

const pageSettings = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: POST_ID },
  id++,
);

const structure = await callTool(
  session,
  "emcp-tools-get-page-structure",
  { post_id: POST_ID, max_depth: 6 },
  id++,
);

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/our-services/?nonitro=1&v=inspect1", {
  waitUntil: "networkidle2",
  timeout: 90000,
});

const textReport = await page.evaluate(() => {
  const cards = document.querySelectorAll(".elementor-widget");
  const sampled = [];
  for (const w of cards) {
    const textNodes = w.querySelectorAll("p, span, h1, h2, h3, h4, h5, div");
    for (const el of textNodes) {
      if (el.children.length === 0 && el.textContent.trim().length > 3) {
        const cs = getComputedStyle(el);
        sampled.push({
          tag: el.tagName,
          text: el.textContent.trim().slice(0, 30),
          color: cs.color,
          fontSize: cs.fontSize,
          fontFamily: cs.fontFamily,
          opacity: cs.opacity,
          visibility: cs.visibility,
          bg: cs.backgroundColor,
        });
      }
    }
  }
  return sampled.slice(0, 40);
});
await browser.close();

process.stdout.write(
  `${JSON.stringify(
    {
      pageSettings: pageSettings.data?.settings?.custom_css,
      widgetsCount: structure.data?.structure?.length,
      sample: textReport,
    },
    null,
    2,
  )}\n`,
);
