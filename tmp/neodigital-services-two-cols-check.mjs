import { mkdirSync } from "node:fs";
import puppeteer from "puppeteer";

const URL = `https://neodigital.ca/?nonitro=1&v=cols2-${Date.now()}`;
const outDir = "tmp/neodigital-services-shots";
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "networkidle2", timeout: 90000 });
await page.waitForSelector(".ygency-info-box", { timeout: 30000 });
await page.evaluate(() => {
  document.querySelector(".ygency-info-box")?.scrollIntoView({ block: "center" });
});

const layout = await page.evaluate(() => {
  const boxes = [...document.querySelectorAll(".ygency-info-box")];
  const rows = new Map();
  for (const box of boxes) {
    const top = Math.round(box.getBoundingClientRect().top);
    const key = [...rows.keys()].find((k) => Math.abs(k - top) < 12) ?? top;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(Math.round(box.getBoundingClientRect().width));
  }
  const counts = [...rows.values()].map((row) => row.length);
  return {
    boxCount: boxes.length,
    firstRowCount: counts[0] || 0,
    rowCounts: counts,
    firstBoxW: boxes[0] ? Math.round(boxes[0].getBoundingClientRect().width) : null,
  };
});

await page.screenshot({ path: `${outDir}/desktop-2col.png`, type: "png" });
await browser.close();
process.stdout.write(`${JSON.stringify(layout, null, 2)}\n`);
