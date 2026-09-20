import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1", { waitUntil: "networkidle2" });

const styles = await page.evaluate(() => {
  const c1Num = document.querySelector(".elementor-element-53edf1d .elementor-counter-number");
  const c2Num = document.querySelector(".elementor-element-04e1b1a .elementor-counter-number");
  const c3Num = document.querySelector(".elementor-element-0ed5015 .elementor-counter-number");

  const c1Wrap = document.querySelector(".elementor-element-53edf1d .counter-wrap");
  const c2Wrap = document.querySelector(".elementor-element-04e1b1a .counter-wrap");
  const c3Wrap = document.querySelector(".elementor-element-0ed5015 .counter-wrap");

  function getDetails(el) {
    if (!el) return null;
    const cs = window.getComputedStyle(el);
    return {
      text: el.textContent,
      color: cs.color,
      webkitTextFillColor: cs.webkitTextFillColor,
      webkitTextStroke: cs.webkitTextStroke,
      webkitTextStrokeColor: cs.webkitTextStrokeColor,
      webkitTextStrokeWidth: cs.webkitTextStrokeWidth,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      opacity: cs.opacity,
      display: cs.display,
      visibility: cs.visibility,
    };
  }

  return {
    c1Num: getDetails(c1Num),
    c2Num: getDetails(c2Num),
    c3Num: getDetails(c3Num),
    c1Wrap: getDetails(c1Wrap),
    c2Wrap: getDetails(c2Wrap),
    c3Wrap: getDetails(c3Wrap),
  };
});

await browser.close();
console.log(JSON.stringify(styles, null, 2));
