import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?elementor_library=neo-cta&nonitro=1", { waitUntil: "networkidle2" });

const ctaData = await page.evaluate(() => {
  const btn = document.querySelector(".ygency-button");
  const heading = document.querySelector("h1, h2, .elementor-heading-title");
  
  // Find all matched CSS rules for btn and btn:hover
  function getRules(selector) {
    const matched = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) {
          if (rule.selectorText && rule.selectorText.includes(selector)) {
            matched.push({
              selector: rule.selectorText,
              cssText: rule.cssText,
            });
          }
        }
      } catch (e) {}
    }
    return matched;
  }

  const btnRules = getRules("ygency-button");

  return {
    btnHtml: btn ? btn.outerHTML : "none",
    btnStyles: btn ? {
      color: window.getComputedStyle(btn).color,
      bgColor: window.getComputedStyle(btn).backgroundColor,
      borderColor: window.getComputedStyle(btn).borderColor,
    } : null,
    btnRules: btnRules.slice(0, 30),
  };
});

await page.screenshot({ path: "b:/Neo Pulse/tmp/template-7605-shot.png" });

await browser.close();
console.log(JSON.stringify(ctaData, null, 2));
