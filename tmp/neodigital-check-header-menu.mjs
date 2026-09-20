import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1", { waitUntil: "networkidle2" });

const menuData = await page.evaluate(() => {
  const nav = document.querySelector(".elementor-widget-ygency-nav-menu, .main-menu, nav");
  const menuLinks = Array.from(document.querySelectorAll(".site-header a, .site-header .menu-item, .elementor-151 a")).map(el => ({
    text: el.textContent.trim(),
    tag: el.tagName,
    className: el.className,
    color: window.getComputedStyle(el).color,
    display: window.getComputedStyle(el).display,
    visibility: window.getComputedStyle(el).visibility,
    opacity: window.getComputedStyle(el).opacity,
    rect: el.getBoundingClientRect(),
    parentClass: el.parentElement ? el.parentElement.className : null,
  }));

  const offcanvas = document.querySelector(".offcanvas-toggle, .toggle-right");
  const offcanvasInfo = offcanvas ? {
    color: window.getComputedStyle(offcanvas).color,
    bgColor: window.getComputedStyle(offcanvas).backgroundColor,
    rect: offcanvas.getBoundingClientRect(),
  } : null;

  return {
    navHtml: nav ? nav.outerHTML.slice(0, 1500) : "not found",
    menuLinks: menuLinks.slice(0, 15),
    offcanvasInfo,
  };
});

await browser.close();
console.log(JSON.stringify(menuData, null, 2));
