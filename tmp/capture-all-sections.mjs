import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1", { waitUntil: "networkidle2" });

const sectionIds = [
  "afa170d", // Hero
  "03b9182", // Ticker
  "3553037", // 150+ section
  "cad7f69", // Local search knowledge
  "ffbd703", // 100% Canadian owned
  "977fa9a", // Proper conversions
  "e1d3275", // What we do (numbered list)
  "e21681d", // Why choose us
  "3164f23", // Edmonton SEO services
  "0bf24ba", // Edmonton coverage
  "30531aa", // FAQ
  "83582cd"  // Contact / CTA
];

for (const id of sectionIds) {
  const el = await page.$(`.elementor-element-${id}`);
  if (el) {
    await el.scrollIntoView();
    await new Promise(r => setTimeout(r, 200));
    await el.screenshot({ path: `tmp/sec-${id}.png` });
  }
}

await browser.close();
console.log("All section screenshots captured!");
