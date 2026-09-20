import puppeteer from "puppeteer";

const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2", timeout: 90000 });

const report = await page.evaluate(() => {
  const parent = document.querySelector(".elementor-element-f51d2a0");
  if (!parent) return { error: "missing f51d2a0" };
  const s = window.getComputedStyle(parent);
  const rows = Array.from(parent.querySelectorAll(":scope > .e-con")).map((row, i) => {
    const rs = window.getComputedStyle(row);
    return {
      i: i + 1,
      id: row.className.match(/elementor-element-(\w+)/)?.[1],
      width: rs.width,
      flexDirection: rs.flexDirection,
      childCount: row.children.length,
    };
  });
  return {
    parentFlexDirection: s.flexDirection,
    parentWidth: s.width,
    rowCount: rows.length,
    rows,
  };
});

console.log(JSON.stringify(report, null, 2));

await page.evaluate(() => {
  const t = document.querySelector(".elementor-element-9d1cb6e");
  t?.scrollIntoView({ block: "start" });
});
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: "tmp/f51-steps-after-fix.png" });

await page.evaluate(() => document.querySelector(".elementor-element-f7b6948")?.scrollIntoView({ block: "center" }));
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: "tmp/f51-step02-after-fix.png" });

await browser.close();
