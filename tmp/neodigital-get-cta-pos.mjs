import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/website-design/?nonitro=1", { waitUntil: "networkidle2" });

const ctaPos = await page.evaluate(() => {
  const cta = document.querySelector(".elementor-element-13b99946");
  if (!cta) return null;
  const rect = cta.getBoundingClientRect();
  return {
    top: rect.top + window.scrollY,
    bottom: rect.bottom + window.scrollY,
    height: rect.height,
    width: rect.width,
  };
});

console.log("CTA Position:", ctaPos);

if (ctaPos) {
  await page.evaluate((top) => window.scrollTo(0, top - 100), ctaPos.top);
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({ path: "b:/Neo Pulse/tmp/website-design-cta-real.png" });
}

await browser.close();
