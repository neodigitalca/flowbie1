import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1", { waitUntil: "networkidle2" });

const headerSnapshot = await page.evaluate(() => {
  const header = document.querySelector(".site-header");
  const navMenu = document.querySelector(".ygency-nav-menu");
  const offcanvas = document.querySelector(".ygency-offcanvas, .offcanvas-toggle");
  return {
    headerRect: header ? header.getBoundingClientRect() : null,
    navMenuRect: navMenu ? navMenu.getBoundingClientRect() : null,
    navMenuDisplay: navMenu ? window.getComputedStyle(navMenu).display : null,
    offcanvasRect: offcanvas ? offcanvas.getBoundingClientRect() : null,
    offcanvasDisplay: offcanvas ? window.getComputedStyle(offcanvas).display : null,
    offcanvasColor: offcanvas ? window.getComputedStyle(offcanvas).color : null,
    offcanvasBg: offcanvas ? window.getComputedStyle(offcanvas).backgroundColor : null,
  };
});

// Take a screenshot of the top section including header and about/stats
await page.screenshot({
  path: "b:/Neo Pulse/tmp/home-top-section.png",
  clip: { x: 0, y: 0, width: 1440, height: 800 },
});

await browser.close();
console.log(JSON.stringify(headerSnapshot, null, 2));
