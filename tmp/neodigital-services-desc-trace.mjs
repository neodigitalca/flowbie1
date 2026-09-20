import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/our-services/?nonitro=1&v=trace", {
  waitUntil: "networkidle2",
  timeout: 90000,
});

const trace = await page.evaluate(() => {
  const p = document.querySelector(".ygency-feature-box .box-desc");
  if (!p) return null;

  // Let's inspect style rules applied to p
  const rules = [];
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules || []) {
        if (rule.selectorText && p.matches(rule.selectorText)) {
          rules.push({
            selector: rule.selectorText,
            cssText: rule.cssText,
            href: sheet.href ? sheet.href.split("/").pop() : "inline",
          });
        }
      }
    } catch (e) {}
  }

  const cs = getComputedStyle(p);
  return {
    color: cs.color,
    fontSize: cs.fontSize,
    fontFamily: cs.fontFamily,
    rules,
  };
});

await browser.close();
process.stdout.write(`${JSON.stringify(trace, null, 2)}\n`);
