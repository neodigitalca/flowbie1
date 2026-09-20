import puppeteer from "puppeteer";

const URLS = [
  "https://neodigital.ca/?nonitro=1",
  "https://neodigital.ca/about/?nonitro=1",
  "https://neodigital.ca/edmonton-seo/?nonitro=1",
  "https://neodigital.ca/our-services/?nonitro=1",
  "https://neodigital.ca/contact/?nonitro=1",
];

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
const results = {};

for (const url of URLS) {
  await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });
  const data = await page.evaluate(() => {
    const ps = [...document.querySelectorAll("p, .description, .box-desc, .elementor-widget-text-editor")];
    const samples = [];
    for (const p of ps) {
      if (p.textContent.trim().length > 10) {
        const cs = getComputedStyle(p);
        samples.push({
          tag: p.tagName,
          cls: p.className,
          text: p.textContent.trim().slice(0, 30),
          color: cs.color,
          fontSize: cs.fontSize,
          fontFamily: cs.fontFamily,
        });
      }
    }
    return samples.slice(0, 5);
  });
  results[url.split("/").filter(Boolean).pop() || "home"] = data;
}

await browser.close();
process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
