import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const bodyReport = await page.evaluate(() => {
  const b = document.body;
  const s = window.getComputedStyle(b);
  const inlineCssTag = document.getElementById("neo-pulse-global-css-inline-css");
  return {
    inlineCssTagExists: !!inlineCssTag,
    inlineCssContent: inlineCssTag ? inlineCssTag.textContent : null,
    bodyFontFamily: s.fontFamily,
    bodyFontWeight: s.fontWeight,
    bodyFontSize: s.fontSize,
    bodyColor: s.color
  };
});

console.log("BODY REPORT AFTER FIX:", JSON.stringify(bodyReport, null, 2));

await browser.close();
