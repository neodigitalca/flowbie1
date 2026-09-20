import { mkdirSync, writeFileSync } from "node:fs";
import puppeteer from "puppeteer";

const URL = "https://neodigital.ca/?nonitro=1&v=rem1";
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
const outDir = "tmp/neodigital-lato-shots";
mkdirSync(outDir, { recursive: true });
const report = [];

for (const vp of VIEWPORTS) {
  await page.setViewport({ width: vp.width, height: vp.height, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: "networkidle2", timeout: 90000 });
  await page.waitForSelector(".ygency-info-box .title-text", { timeout: 30000 });
  await page.evaluate(() => {
    document.querySelector(".ygency-info-box")?.scrollIntoView({ block: "center" });
  });
  const row = await page.evaluate((rootPx) => {
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const box = document.querySelector(".ygency-info-box");
    const title = box?.querySelector(".title-text");
    const desc = box?.querySelector(".description");
    const heading = [...document.querySelectorAll(".elementor-heading-title")].find((el) =>
      (el.textContent || "").includes("Modern Website"),
    );
    const measure = (el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      const parent = el.closest(".ygency-info-box") || el.parentElement;
      const pr = parent.getBoundingClientRect();
      return {
        family: cs.fontFamily,
        sizePx: parseFloat(cs.fontSize),
        sizeRem: +(parseFloat(cs.fontSize) / root).toFixed(3),
        color: cs.color,
        w: Math.round(r.width),
        h: Math.round(r.height),
        overflow: r.width > pr.width + 2 || r.height > pr.height + 40,
      };
    };
    return {
      rootPx: root,
      title: measure(title),
      desc: measure(desc),
      heading: measure(heading),
      boxW: box ? Math.round(box.getBoundingClientRect().width) : null,
      icon: Boolean(box?.querySelector(".box-icon img, .box-icon svg")),
    };
  });
  const shot = `${outDir}/${vp.name}.png`;
  await page.screenshot({ path: shot, type: "png" });
  report.push({ viewport: vp, ...row, shot });
}

await browser.close();
writeFileSync("tmp/neodigital-lato-puppeteer.json", `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
