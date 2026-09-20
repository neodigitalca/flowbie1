import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  launchBrowserWithResidentialProxy,
  isProxyConfigured,
  resolveResidentialProxyEnv,
} from "../../scripts/research/residential-proxy/lib.mjs";

if (!isProxyConfigured()) {
  console.error("no proxy");
  process.exit(1);
}

const { browser, page } = await launchBrowserWithResidentialProxy({
  headed: false,
  env: resolveResidentialProxyEnv(),
});
try {
  await page.goto("https://neodigital.ca/local-seo/?nocache=1", { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForNetworkIdle({ idleTime: 400, timeout: 8000 }).catch(() => {});
  const html = await page.content();
  writeFileSync(join(import.meta.dirname, "local-seo-nocache.html"), html, "utf8");
  const report = await page.evaluate(() => ({
    bodyClass: document.body?.className?.slice(0, 200),
    widgets: document.querySelectorAll(".elementor-widget, .elementor-element").length,
    h1: [...document.querySelectorAll("h1")].map((el) => el.innerText.trim()).slice(0, 4),
    sheets: [...document.querySelectorAll('link[rel="stylesheet"]')].length,
    elementorSheets: [...document.querySelectorAll('link[rel="stylesheet"]')].filter((el) => el.href.includes("elementor")).length,
  }));
  console.log(JSON.stringify(report, null, 2));
  await page.screenshot({ path: "tmp/pagespeed/local-seo-nocache.png", fullPage: false });
} finally {
  await browser.close();
}
