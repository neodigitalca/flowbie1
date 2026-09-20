import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1", { waitUntil: "networkidle2" });

const report = await page.evaluate(() => {
  const getElReport = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const computed = window.getComputedStyle(el);
    const p = el.querySelector("p") || el;
    const pComputed = window.getComputedStyle(p);
    return {
      selector,
      color: computed.color,
      pColor: pComputed.color,
      fontFamily: pComputed.fontFamily,
      fontSize: pComputed.fontSize,
      opacity: pComputed.opacity,
      html: el.outerHTML.slice(0, 300)
    };
  };

  return {
    a75aad3: getElReport(".elementor-element-a75aad3"),
    e2ce6fe: getElReport(".elementor-element-e2ce6fe"),
    "9474c98": getElReport(".elementor-element-9474c98"),
    "859fe91": getElReport(".elementor-element-859fe91"),
    "7364af0": getElReport(".elementor-element-7364af0"),
    bbdcc6b: getElReport(".elementor-element-bbdcc6b"),
    "79b72fd": getElReport(".elementor-element-79b72fd"),
  };
});

console.log("RENDERED STYLES:", JSON.stringify(report, null, 2));

await browser.close();
