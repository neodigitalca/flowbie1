import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const report = await page.evaluate(() => {
  const p = document.querySelector(".elementor-element-ba7052d p") || document.querySelector(".elementor-element-ba7052d");
  if (!p) return null;

  const rules = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules || [])) {
        if (rule.selectorText && p.matches(rule.selectorText)) {
          rules.push({
            selector: rule.selectorText,
            fontWeight: rule.style?.fontWeight,
            fontFamily: rule.style?.fontFamily,
            fontSize: rule.style?.fontSize,
            color: rule.style?.color,
            cssText: rule.cssText.slice(0, 150),
            href: sheet.href ? sheet.href.split("/").slice(-2).join("/") : "inline"
          });
        }
      }
    } catch (e) {}
  }
  return {
    computedFontWeight: window.getComputedStyle(p).fontWeight,
    computedFontFamily: window.getComputedStyle(p).fontFamily,
    computedFontSize: window.getComputedStyle(p).fontSize,
    rules
  };
});

console.log("BA7052D REPORT:", JSON.stringify(report, null, 2));

await browser.close();
