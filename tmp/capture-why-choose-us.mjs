import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const sectionInfo = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll("*"));
  const target = all.find(el => el.textContent && el.textContent.includes("We Aren"));
  if (!target) return null;
  target.scrollIntoView();
  return {
    outerHTML: target.outerHTML.slice(0, 300),
    rect: target.getBoundingClientRect()
  };
});

console.log("SECTION INFO:", sectionInfo);

await new Promise(r => setTimeout(r, 1000));
await page.screenshot({ path: "tmp/verify-homepage-why-choose-us-real.png" });

await browser.close();
