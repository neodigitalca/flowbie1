import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1", { waitUntil: "networkidle2" });

const match = await page.evaluate(() => {
  const p = document.querySelector(".elementor-element-e2ce6fe p");
  if (!p) return null;
  const rules = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules || [])) {
        if (rule.selectorText && p.matches(rule.selectorText)) {
          if (rule.style && rule.style.color) {
            rules.push({
              selector: rule.selectorText,
              color: rule.style.color,
              cssText: rule.cssText.slice(0, 100),
              href: sheet.href ? sheet.href.split("/").slice(-2).join("/") : "inline"
            });
          }
        }
      }
    } catch (e) {}
  }
  return rules;
});

console.log("RULES MATCHING e2ce6fe p:", JSON.stringify(match, null, 2));

await browser.close();
