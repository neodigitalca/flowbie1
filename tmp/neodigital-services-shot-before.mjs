import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";

const outDir = "tmp/services-fix-shots";
mkdirSync(outDir, { recursive: true });

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/our-services/?nonitro=1&v=before", {
  waitUntil: "networkidle2",
  timeout: 90000,
});
await page.waitForSelector(".ygency-feature-box", { timeout: 30000 });
await page.evaluate(() => {
  document.querySelector(".ygency-feature-box")?.scrollIntoView({ block: "center" });
});
await page.screenshot({ path: `${outDir}/before.png`, type: "png" });
await browser.close();
process.stdout.write("Captured before screenshot\n");
