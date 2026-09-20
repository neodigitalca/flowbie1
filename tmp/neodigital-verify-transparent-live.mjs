import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/website-design/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const ctaCon = await page.$(".elementor-element-13b99946");
if (ctaCon) {
  await ctaCon.scrollIntoView();
  await new Promise(r => setTimeout(r, 800));

  // Default transparent state screenshot
  await page.screenshot({ path: "b:/Neo Pulse/tmp/verify-cta-transparent-default.png" });

  const btn = await page.$(".elementor-element-6eb27dc1 a.ygency-button");
  if (btn) {
    await btn.hover();
    await new Promise(r => setTimeout(r, 500));
    // Hover state screenshot
    await page.screenshot({ path: "b:/Neo Pulse/tmp/verify-cta-transparent-hover.png" });
  }
}

await browser.close();
console.log("Verified live transparent CTA!");
