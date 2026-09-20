import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1", { waitUntil: "networkidle2" });

const footer163 = await page.$(".elementor-163");
if (footer163) {
  await footer163.screenshot({ path: "b:/Neo Pulse/tmp/footer-real-desktop.png" });
}

await page.setViewport({ width: 390, height: 844 });
await new Promise(r => setTimeout(r, 1000));

const mobileFooter = await page.$(".elementor-163");
if (mobileFooter) {
  await mobileFooter.screenshot({ path: "b:/Neo Pulse/tmp/footer-real-mobile.png" });
}

await browser.close();
console.log("Footer screenshots captured successfully!");
