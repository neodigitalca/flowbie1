import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1", { waitUntil: "networkidle2" });

const sec355 = await page.evaluate(() => {
  const sec = document.querySelector(".elementor-element-3553037");
  if (!sec) return null;
  return Array.from(sec.querySelectorAll(".elementor-element")).map(el => {
    const r = el.getBoundingClientRect();
    const s = window.getComputedStyle(el);
    return {
      id: el.getAttribute("data-id"),
      tag: el.tagName,
      class: el.className.split(" ").slice(0, 3).join(" "),
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      text: el.innerText ? el.innerText.trim().slice(0, 60) : ""
    };
  });
});

console.log("3553037 DETAILS:", JSON.stringify(sec355, null, 2));

await browser.close();
