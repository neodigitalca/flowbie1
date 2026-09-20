import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1", { waitUntil: "networkidle2" });

const heroDetails = await page.evaluate(() => {
  const hero = document.querySelector(".elementor-element-afa170d");
  const h1 = document.querySelector(".elementor-element-2bbef65");
  const col1 = document.querySelector(".elementor-element-e8af43f");
  const col2 = document.querySelector(".elementor-element-bb9c5ef");
  const col3 = document.querySelector(".elementor-element-f7d4e39");

  const getDetails = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = window.getComputedStyle(el);
    return {
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      flex: s.flex,
      width: s.width,
      maxWidth: s.maxWidth,
      display: s.display,
      html: el.innerHTML.slice(0, 300)
    };
  };

  return {
    hero: getDetails(hero),
    h1: getDetails(h1),
    col1: getDetails(col1),
    col2: getDetails(col2),
    col3: getDetails(col3)
  };
});

console.log("HERO DETAILS:", JSON.stringify(heroDetails, null, 2));

// Also let's inspect the "150+" section (cad7f69)
const sec150Details = await page.evaluate(() => {
  const sec = document.querySelector(".elementor-element-cad7f69");
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

console.log("150 SEC DETAILS:", JSON.stringify(sec150Details, null, 2));

await browser.close();
