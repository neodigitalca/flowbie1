import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1", { waitUntil: "networkidle2" });

const info = await page.evaluate(() => {
  const cta = document.querySelector(".neo-footer-cta-card");
  const footer163 = document.querySelector(".elementor-163");
  const siteFooter = document.querySelector(".site-footer");
  return {
    ctaBox: cta ? cta.getBoundingClientRect() : null,
    footer163Box: footer163 ? footer163.getBoundingClientRect() : null,
    siteFooterBox: siteFooter ? siteFooter.getBoundingClientRect() : null,
    scrollY: window.scrollY,
  };
});

console.log(info);
await browser.close();
