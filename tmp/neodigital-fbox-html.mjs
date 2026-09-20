import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/our-services/?nonitro=1&v=fboxhtml", {
  waitUntil: "networkidle2",
  timeout: 90000,
});

const html = await page.evaluate(() => {
  const box = document.querySelector(".ygency-feature-box");
  return box ? box.outerHTML : null;
});

await browser.close();
process.stdout.write(`${html}\n`);
