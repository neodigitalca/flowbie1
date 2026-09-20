import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1", { waitUntil: "networkidle2" });

// Evaluate each top-level section/container under .elementor-10203
const sections = await page.evaluate(() => {
  const root = document.querySelector(".elementor-10203");
  if (!root) return { error: "no .elementor-10203" };

  const direct = Array.from(root.children);
  return direct.map((el, i) => {
    const rect = el.getBoundingClientRect();
    const computed = window.getComputedStyle(el);
    return {
      index: i,
      tag: el.tagName,
      id: el.id,
      className: el.className,
      dataId: el.getAttribute("data-id"),
      width: rect.width,
      height: rect.height,
      top: rect.top + window.scrollY,
      display: computed.display,
      flexDirection: computed.flexDirection,
      textContent: el.innerText ? el.innerText.trim().slice(0, 100) : "",
    };
  });
});

console.log("SECTIONS:", JSON.stringify(sections, null, 2));

// Check hero section specifics
const heroInfo = await page.evaluate(() => {
  const h1 = document.querySelector(".elementor-10203 h1, .elementor-element-2bbef65");
  const heroContainer = document.querySelector(".elementor-element-afa170d");
  const subCon = document.querySelector(".elementor-element-4101a06");
  
  return {
    h1: h1 ? {
      rect: h1.getBoundingClientRect(),
      text: h1.innerText,
      styles: {
        fontFamily: window.getComputedStyle(h1).fontFamily,
        fontSize: window.getComputedStyle(h1).fontSize,
        marginTop: window.getComputedStyle(h1).marginTop,
        transform: window.getComputedStyle(h1).transform,
        position: window.getComputedStyle(h1).position,
        top: window.getComputedStyle(h1).top,
      }
    } : null,
    heroContainer: heroContainer ? {
      rect: heroContainer.getBoundingClientRect(),
      styles: {
        paddingTop: window.getComputedStyle(heroContainer).paddingTop,
        marginTop: window.getComputedStyle(heroContainer).marginTop,
      }
    } : null,
    subCon: subCon ? {
      rect: subCon.getBoundingClientRect(),
      children: Array.from(subCon.children).map(c => ({
        class: c.className,
        rect: c.getBoundingClientRect(),
        dataId: c.getAttribute("data-id")
      }))
    } : null
  };
});

console.log("HERO INFO:", JSON.stringify(heroInfo, null, 2));

await browser.close();
