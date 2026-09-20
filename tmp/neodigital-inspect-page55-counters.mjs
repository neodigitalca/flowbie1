import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1", { waitUntil: "networkidle2" });

const cRules = await page.evaluate(() => {
  const c1 = document.querySelector(".elementor-element-53edf1d");
  const c2 = document.querySelector(".elementor-element-04e1b1a");
  const c3 = document.querySelector(".elementor-element-0ed5015");

  function getRulesFor(el) {
    if (!el) return [];
    const matched = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          if (rule.selectorText && (el.matches(rule.selectorText) || el.querySelector(rule.selectorText))) {
            matched.push({ selector: rule.selectorText, cssText: rule.cssText });
          }
        }
      } catch (e) {}
    }
    return matched;
  }

  return {
    c1: getRulesFor(c1),
    c2: getRulesFor(c2),
    c3: getRulesFor(c3),
  };
});

await browser.close();
console.log(JSON.stringify(cRules, null, 2));
