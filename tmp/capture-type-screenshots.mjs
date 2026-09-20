import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();

// 1. Screenshot of /edmonton-seo/
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });
await page.evaluate(() => {
  const el = document.querySelector(".elementor-element-3553037");
  if (el) el.scrollIntoView();
});
await new Promise(r => setTimeout(r, 1000));
await page.screenshot({ path: "tmp/verify-edmonton-seo-type.png" });

// 2. Screenshot of Homepage hero + intro
await page.goto("https://neodigital.ca/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });
await new Promise(r => setTimeout(r, 1000));
await page.screenshot({ path: "tmp/verify-homepage-hero-type.png" });

// 3. Screenshot of Homepage "Why Choose Us"
await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll("*"));
  const why = all.find(el => el.textContent && el.textContent.includes("We Aren’t Your Regular Agency"));
  if (why) why.scrollIntoView();
});
await new Promise(r => setTimeout(r, 1000));
await page.screenshot({ path: "tmp/verify-homepage-why-choose-us.png" });

await browser.close();
console.log("Screenshots captured!");
