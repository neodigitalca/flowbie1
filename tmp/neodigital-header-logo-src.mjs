import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1", { waitUntil: "networkidle2" });
const logoSrc = await page.evaluate(() => {
  const img = document.querySelector(".main-header img, header img, .site-header img, .navbar-brand img");
  return img ? img.src : null;
});
await browser.close();
console.log({ headerLogo: logoSrc });
