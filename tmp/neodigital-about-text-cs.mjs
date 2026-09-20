import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/about/?nonitro=1&v=aboutcolor", {
  waitUntil: "networkidle2",
  timeout: 90000,
});

const textCs = await page.evaluate(() => {
  const p = document.querySelector(".elementor-widget-text-editor p");
  if (!p) return null;
  const cs = getComputedStyle(p);
  return {
    color: cs.color,
    fontSize: cs.fontSize,
    fontFamily: cs.fontFamily,
    lineHeight: cs.lineHeight,
  };
});

await browser.close();
process.stdout.write(`${JSON.stringify(textCs, null, 2)}\n`);
