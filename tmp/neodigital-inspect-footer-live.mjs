import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1&v=inspect_footer_live", {
  waitUntil: "networkidle2",
  timeout: 90000,
});

const footerHtml = await page.evaluate(() => {
  const f = document.querySelector(".site-footer");
  return f ? f.outerHTML.slice(0, 3000) : "no footer";
});

await browser.close();
console.log(footerHtml);
