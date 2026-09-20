import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const rect = await page.evaluate(() => {
  const el = document.querySelector(".elementor-element-f51d2a0");
  if (!el) return null;
  el.scrollIntoView();
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});

console.log("SECTION RECT:", rect);
await new Promise(r => setTimeout(r, 1000));
await page.screenshot({ path: "tmp/section-f51d2a0-live.png" });

await browser.close();
