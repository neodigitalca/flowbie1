import { callTool, openEmcp } from "./emcp-http.mjs";
import puppeteer from "puppeteer";

const session = await openEmcp("neo-pulse-accent-sample");
const globals = await callTool(session, "emcp-tools-get-global-settings", {}, 2);
const g = globals.data || {};

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();

async function sample(url, fn) {
  await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });
  return page.evaluate(fn);
}

const about = await sample("https://neodigital.ca/about/?nonitro=1&v=accent1", () => {
  const who = [...document.querySelectorAll("h1,h2,h3,h4,h5,p,span,div")].find((el) =>
    (el.textContent || "").trim().toLowerCase().startsWith("who we are"),
  );
  const icon = document.querySelector(".elementor-icon, .elementor-icon i, .elementor-icon svg");
  const cs = (el) => {
    if (!el) return null;
    const s = getComputedStyle(el);
    return { color: s.color, fill: s.fill, text: (el.textContent || "").trim().slice(0, 40) };
  };
  return { who: cs(who), icon: cs(icon) };
});

const home = await sample("https://neodigital.ca/?nonitro=1&v=accent1", () => {
  const digit = document.querySelector(
    ".qodef-m-digit, .qi-counter .qodef-m-digit, [class*='digit']",
  );
  const label = document.querySelector(".qodef-m-digit-label, [class*='digit-label']");
  const cs = (el) => (el ? getComputedStyle(el).color : null);
  return {
    digit: cs(digit),
    label: cs(label),
    digitText: digit ? digit.textContent.trim().slice(0, 12) : null,
  };
});

await browser.close();
process.stdout.write(
  `${JSON.stringify(
    {
      colors: g.colors || g.settings?.system_colors || g.system_colors,
      customColors: g.custom_colors || g.settings?.custom_colors,
      about,
      home,
    },
    null,
    2,
  )}\n`,
);
