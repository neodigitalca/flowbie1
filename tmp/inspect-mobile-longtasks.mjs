import puppeteer from "puppeteer";

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true });
const t0 = Date.now();
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1&v=" + Date.now(), { waitUntil: "domcontentloaded", timeout: 90000 });
const dom = Date.now() - t0;
await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});
const idle = Date.now() - t0;

const metrics = await page.evaluate(() => {
  const nav = performance.getEntriesByType("navigation")[0];
  return {
    domContentLoaded: nav?.domContentLoadedEventEnd,
    loadEvent: nav?.loadEventEnd,
    transferSize: nav?.transferSize,
  };
});

console.log({ domMs: dom, idleMs: idle, metrics });
await browser.close();
