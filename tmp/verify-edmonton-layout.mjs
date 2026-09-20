import puppeteer from "puppeteer";

const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2", timeout: 60000 });

const report = await page.evaluate(() => {
  const ids = ["3553037", "cad7f69", "fb92c02", "f3851d6", "d73fdd3"];
  return ids.map(id => {
    const el = document.querySelector(`.elementor-element-${id}`);
    if (!el) return { id, missing: true };
    const r = el.getBoundingClientRect();
    const s = window.getComputedStyle(el);
    return {
      id,
      x: r.x,
      width: r.width,
      overflow: s.overflow,
      paddingLeft: s.paddingLeft,
      textSample: el.innerText?.slice(0, 40),
    };
  });
});

console.log(JSON.stringify(report, null, 2));

await page.evaluate(() => document.querySelector(".elementor-element-3553037")?.scrollIntoView());
await new Promise(r => setTimeout(r, 600));
await page.screenshot({ path: "tmp/edmonton-after-rollback.png", fullPage: false });

await browser.close();
