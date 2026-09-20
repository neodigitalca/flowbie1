import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();

// 1. Check Home Page Counters
await page.goto("https://neodigital.ca/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });
const counterSection = await page.$(".elementor-element-39ac587, .elementor-element-1a69bf4");
if (counterSection) {
  await counterSection.scrollIntoView();
  await new Promise(r => setTimeout(r, 1200)); // wait for counter animation
  await page.screenshot({ path: "b:/Neo Pulse/tmp/verify-home-counters-white.png" });
}

const homeCounterStyles = await page.evaluate(() => {
  const c1 = document.querySelector(".elementor-element-53edf1d .elementor-counter-number");
  const c2 = document.querySelector(".elementor-element-04e1b1a .elementor-counter-number");
  const c3 = document.querySelector(".elementor-element-0ed5015 .elementor-counter-number");
  return {
    c1: c1 ? { text: c1.textContent, color: window.getComputedStyle(c1).color } : null,
    c2: c2 ? { text: c2.textContent, color: window.getComputedStyle(c2).color } : null,
    c3: c3 ? { text: c3.textContent, color: window.getComputedStyle(c3).color } : null,
  };
});
console.log("Home counters:", homeCounterStyles);

// 2. Check CTA Button on Website Design (Template 7605 instance)
await page.goto("https://neodigital.ca/website-design/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const ctaCon = await page.$(".elementor-element-13b99946");
if (ctaCon) {
  await ctaCon.scrollIntoView();
  await new Promise(r => setTimeout(r, 800));

  const btn = await page.$(".elementor-element-6eb27dc1 a.ygency-button");
  if (btn) {
    // Screenshot before hover
    await page.screenshot({ path: "b:/Neo Pulse/tmp/verify-cta-default.png" });

    // Hover
    await btn.hover();
    await new Promise(r => setTimeout(r, 600));

    const hoverData = await page.evaluate(() => {
      const b = document.querySelector(".elementor-element-6eb27dc1 a.ygency-button");
      const text = b.querySelector(".button-text");
      const icon = b.querySelector(".button-icon i");
      return {
        bg: window.getComputedStyle(b).backgroundColor,
        color: window.getComputedStyle(b).color,
        border: window.getComputedStyle(b).borderColor,
        textColor: text ? window.getComputedStyle(text).color : null,
        iconColor: icon ? window.getComputedStyle(icon).color : null,
        beforeBg: window.getComputedStyle(b, "::before").backgroundColor,
        beforeWidth: window.getComputedStyle(b, "::before").width,
      };
    });
    console.log("CTA Button Hover:", hoverData);

    // Screenshot after hover
    await page.screenshot({ path: "b:/Neo Pulse/tmp/verify-cta-hover-white-font.png" });
  }
}

await browser.close();
