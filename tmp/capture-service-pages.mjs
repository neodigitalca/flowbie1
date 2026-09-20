import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();

await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1", { waitUntil: "networkidle2" });
await page.screenshot({ path: "tmp/edmonton-seo-full.png", fullPage: true });

await page.goto("https://neodigital.ca/local-seo/?nonitro=1", { waitUntil: "networkidle2" });
await page.screenshot({ path: "tmp/local-seo-full.png", fullPage: true });

await browser.close();
console.log("Screenshots captured!");
