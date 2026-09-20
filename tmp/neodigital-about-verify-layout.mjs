import { callTool, openEmcp } from "./emcp-http.mjs";
import puppeteer from "puppeteer";

const session = await openEmcp("neo-pulse-about-verify-layout");
let id = 2;
const intro = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: 129, element_id: "6e9d357" },
  id++,
);
const team = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: 129, element_id: "86db9e8" },
  id++,
);

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto(`https://neodigital.ca/about/?nonitro=1&v=layout-${Date.now()}`, {
  waitUntil: "networkidle2",
  timeout: 90000,
});

const layout = await page.evaluate(() => {
  const text = [...document.querySelectorAll(".elementor-widget-text-editor")].find((el) =>
    (el.textContent || "").includes("Neo Digital is a local"),
  );
  const target = document.querySelector('img[src*="target.png"]');
  const people = [...document.querySelectorAll("h3, .elementor-heading-title")].filter((el) =>
    /Matt Dimopoulos|Bob Runcer|Sean Craig/.test(el.textContent || ""),
  );
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  };
  return {
    text: box(text),
    target: box(target),
    people: people.map((el) => ({ name: el.textContent.trim(), ...box(el) })),
    sideBySide: Boolean(text && target && Math.abs(text.getBoundingClientRect().top - target.getBoundingClientRect().top) < 200),
  };
});
await browser.close();

process.stdout.write(
  `${JSON.stringify(
    {
      introGrid: intro.data?.settings?.grid_columns_grid,
      introType: intro.data?.settings?.container_type,
      teamGrid: team.data?.settings?.grid_columns_grid,
      teamType: team.data?.settings?.container_type,
      layout,
    },
    null,
    2,
  )}\n`,
);
