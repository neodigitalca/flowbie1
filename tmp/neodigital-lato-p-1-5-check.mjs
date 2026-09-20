import puppeteer from "puppeteer";

const URL = `https://neodigital.ca/?nonitro=1&v=p15-${Date.now()}`;
const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "networkidle2", timeout: 90000 });
await page.waitForSelector(".ygency-info-box .description", { timeout: 30000 });

const report = await page.evaluate(() => {
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
  const desc = document.querySelector(".ygency-info-box .description");
  const p = document.querySelector(".elementor-widget p");
  const size = (el) => {
    if (!el) return null;
    const px = parseFloat(getComputedStyle(el).fontSize);
    return { px, rem: +(px / root).toFixed(3), family: getComputedStyle(el).fontFamily };
  };
  return { root, description: size(desc), paragraph: size(p) };
});

await browser.close();
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
