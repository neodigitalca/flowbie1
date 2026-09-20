import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1", { waitUntil: "networkidle2" });

const cssRules = await page.evaluate(() => {
  const el = document.querySelector(".elementor-element-53edf1d .counter-wrap");
  const num = document.querySelector(".elementor-element-53edf1d .elementor-counter-number");
  
  // Find all matched CSS rules
  function getMatchedCSSRules(element) {
    const matched = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          if (rule.selectorText && element.matches(rule.selectorText)) {
            matched.push({
              selector: rule.selectorText,
              cssText: rule.cssText,
              href: sheet.href,
            });
          }
        }
      } catch (e) {}
    }
    return matched;
  }

  return {
    wrapRules: getMatchedCSSRules(el),
    numRules: getMatchedCSSRules(num),
  };
});

await browser.close();
console.log(JSON.stringify(cssRules, null, 2));
