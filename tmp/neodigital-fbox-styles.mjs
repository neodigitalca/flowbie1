import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/our-services/?nonitro=1&v=fboxstyles", {
  waitUntil: "networkidle2",
  timeout: 90000,
});

const styles = await page.evaluate(() => {
  const box = document.querySelector(".ygency-feature-box");
  const index = box?.querySelector(".box-index");
  const title = box?.querySelector(".box-title");
  const desc = box?.querySelector(".box-desc");
  const arrow = box?.querySelector(".arrow-button");
  const measure = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      color: cs.color,
      fontSize: cs.fontSize,
      fontFamily: cs.fontFamily,
      lineHeight: cs.lineHeight,
      webkitTextStroke: cs.webkitTextStroke,
      opacity: cs.opacity,
    };
  };
  return {
    index: measure(index),
    title: measure(title),
    desc: measure(desc),
    arrow: measure(arrow),
  };
});

await browser.close();
process.stdout.write(`${JSON.stringify(styles, null, 2)}\n`);
