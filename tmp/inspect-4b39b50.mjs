import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const report = await page.evaluate(() => {
  const el = document.querySelector(".elementor-element-4b39b50");
  if (!el) return null;
  const s = window.getComputedStyle(el);
  const titles = Array.from(el.querySelectorAll(".title, h2, span, *")).map(child => {
    const cs = window.getComputedStyle(child);
    return {
      tag: child.tagName,
      class: child.className,
      text: child.innerText,
      color: cs.color,
      fontFamily: cs.fontFamily,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight
    };
  });
  return {
    outerHTML: el.outerHTML,
    titles
  };
});

console.log("4B39B50 REPORT:", JSON.stringify(report, null, 2));

await browser.close();
