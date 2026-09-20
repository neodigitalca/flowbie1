import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const bodyRules = await page.evaluate(() => {
  const body = document.body;
  const rules = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules || [])) {
        if (rule.selectorText && body.matches(rule.selectorText)) {
          if (rule.style && rule.style.fontWeight) {
            rules.push({
              selector: rule.selectorText,
              fontWeight: rule.style.fontWeight,
              fontSize: rule.style.fontSize,
              fontFamily: rule.style.fontFamily,
              cssText: rule.cssText.slice(0, 200),
              href: sheet.href ? sheet.href.split("/").slice(-2).join("/") : "inline"
            });
          }
        }
      }
    } catch (e) {}
  }
  return rules;
});

console.log("BODY RULES:", JSON.stringify(bodyRules, null, 2));

await browser.close();
