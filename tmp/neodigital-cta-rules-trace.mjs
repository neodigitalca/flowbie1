import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1&v=ctarules", {
  waitUntil: "networkidle2",
  timeout: 90000,
});

const rules = await page.evaluate(() => {
  const a = document.querySelector(".ygency-button.icon-top");
  if (!a) return null;
  const list = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules || []) {
        if (rule.selectorText && a.matches(rule.selectorText)) {
          list.push({
            selector: rule.selectorText,
            cssText: rule.cssText,
          });
        }
      }
    } catch (e) {}
  }
  return list;
});

await browser.close();
process.stdout.write(`${JSON.stringify(rules, null, 2)}\n`);
