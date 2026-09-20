import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/our-services/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const rect = await page.evaluate(() => {
  const el = document.querySelector(".ygency-feature-box");
  if (!el) return null;
  el.scrollIntoView({ block: "center" });
  return el.getBoundingClientRect();
});

console.log("FEATURE BOX RECT:", rect);
await new Promise(r => setTimeout(r, 800));
await page.screenshot({ path: "tmp/feature-box-sample.png" });

await browser.close();
