import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/our-services/?nonitro=1&v=fbox", {
  waitUntil: "networkidle2",
  timeout: 90000,
});

const boxData = await page.evaluate(() => {
  const box = document.querySelector(".ygency-feature-box");
  if (!box) return null;
  const elements = [box, ...box.querySelectorAll("*")];
  return elements.map((el) => {
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName,
      cls: el.className,
      text: el.children.length === 0 ? el.textContent.trim() : "",
      color: cs.color,
      fontSize: cs.fontSize,
      fontFamily: cs.fontFamily,
      lineHeight: cs.lineHeight,
      opacity: cs.opacity,
    };
  }).filter((x) => x.text);
});

await browser.close();
process.stdout.write(`${JSON.stringify(boxData, null, 2)}\n`);
