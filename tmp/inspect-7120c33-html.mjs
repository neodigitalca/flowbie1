import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const infoBoxHtml = await page.evaluate(() => {
  const el = document.querySelector(".elementor-element-7120c33");
  return el ? el.outerHTML : null;
});

console.log("INFO BOX HTML:", infoBoxHtml);

await browser.close();
