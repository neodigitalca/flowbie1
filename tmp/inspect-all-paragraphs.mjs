import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();

console.log("=== INSPECTING /edmonton-seo/ ===");
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const edmontonP = await page.evaluate(() => {
  const pList = Array.from(document.querySelectorAll("p, .elementor-widget-text-editor"));
  return pList.map(p => {
    const s = window.getComputedStyle(p);
    return {
      text: p.innerText?.slice(0, 50).trim(),
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      lineHeight: s.lineHeight,
      color: s.color,
      className: p.className
    };
  }).filter(item => item.text && item.text.length > 5);
});

console.log("EDMONTON SEO PARAGRAPHS:", JSON.stringify(edmontonP.slice(0, 15), null, 2));

console.log("=== INSPECTING HOMEPAGE / ===");
await page.goto("https://neodigital.ca/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const homeP = await page.evaluate(() => {
  const pList = Array.from(document.querySelectorAll("p, .elementor-widget-text-editor"));
  return pList.map(p => {
    const s = window.getComputedStyle(p);
    return {
      text: p.innerText?.slice(0, 50).trim(),
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      lineHeight: s.lineHeight,
      color: s.color,
      className: p.className
    };
  }).filter(item => item.text && item.text.length > 5);
});

console.log("HOMEPAGE PARAGRAPHS:", JSON.stringify(homeP.slice(0, 15), null, 2));

await browser.close();
