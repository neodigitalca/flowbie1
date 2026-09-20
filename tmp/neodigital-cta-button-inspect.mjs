import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1&v=cta", {
  waitUntil: "networkidle2",
  timeout: 90000,
});

const btn = await page.evaluate(() => {
  const a = document.querySelector(".ygency-button.icon-top, a[href*='contact'].ygency-button");
  if (!a) return null;
  const cs = getComputedStyle(a);
  return {
    cls: a.className,
    text: a.textContent.trim(),
    backgroundColor: cs.backgroundColor,
    backgroundImage: cs.backgroundImage,
    color: cs.color,
    border: cs.border,
    borderRadius: cs.borderRadius,
    width: cs.width,
    height: cs.height,
  };
});

await browser.close();
process.stdout.write(`${JSON.stringify(btn, null, 2)}\n`);
