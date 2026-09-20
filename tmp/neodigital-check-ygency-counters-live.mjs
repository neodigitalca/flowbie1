import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1", { waitUntil: "networkidle2" });

const countersData = await page.evaluate(() => {
  const c1 = document.querySelector(".elementor-element-53edf1d");
  const c2 = document.querySelector(".elementor-element-04e1b1a");
  const c3 = document.querySelector(".elementor-element-0ed5015");

  function getInfo(el) {
    if (!el) return null;
    const num = el.querySelector(".count-text, .counter-number, .number, [class*='count']");
    const title = el.querySelector(".title, .counter-title, [class*='title']");
    return {
      outerHtml: el.outerHTML,
      numText: num ? num.textContent : null,
      numHtml: num ? num.outerHTML : null,
      numStyles: num ? {
        color: window.getComputedStyle(num).color,
        webkitTextFillColor: window.getComputedStyle(num).webkitTextFillColor,
        webkitTextStroke: window.getComputedStyle(num).webkitTextStroke,
        display: window.getComputedStyle(num).display,
        visibility: window.getComputedStyle(num).visibility,
        opacity: window.getComputedStyle(num).opacity,
        fontSize: window.getComputedStyle(num).fontSize,
        fontFamily: window.getComputedStyle(num).fontFamily,
      } : null,
      titleText: title ? title.textContent : null,
      titleStyles: title ? {
        color: window.getComputedStyle(title).color,
        display: window.getComputedStyle(title).display,
        visibility: window.getComputedStyle(title).visibility,
        opacity: window.getComputedStyle(title).opacity,
      } : null,
    };
  }

  return {
    c1: getInfo(c1),
    c2: getInfo(c2),
    c3: getInfo(c3),
  };
});

await browser.close();
console.log(JSON.stringify(countersData, null, 2));
