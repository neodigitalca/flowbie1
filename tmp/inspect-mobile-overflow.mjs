import puppeteer from "puppeteer";

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true });
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2", timeout: 90000 });

const overflow = await page.evaluate(() => {
  const doc = document.documentElement;
  return {
    scrollWidth: doc.scrollWidth,
    clientWidth: doc.clientWidth,
    overflowX: doc.scrollWidth > doc.clientWidth + 2,
    wide: Array.from(document.querySelectorAll("*"))
      .map((el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 400) return null;
        return { cls: el.className?.slice?.(0, 80), w: r.width, x: r.x };
      })
      .filter(Boolean)
      .slice(0, 15),
  };
});
console.log(JSON.stringify(overflow, null, 2));
await browser.close();
