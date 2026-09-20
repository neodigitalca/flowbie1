import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const report = await page.evaluate(() => {
  const p = document.querySelector(".elementor-element-ba7052d p");
  const s = window.getComputedStyle(p);
  return {
    fontFamily: s.fontFamily,
    fontWeight: s.fontWeight,
    fontSize: s.fontSize,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    webkitFontSmoothing: s.webkitFontSmoothing
  };
});

console.log("BA7052D COMPUTED:", JSON.stringify(report, null, 2));

await browser.close();
