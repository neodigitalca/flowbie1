import puppeteer from "puppeteer";
import fs from "fs";

const TARGET_URL = "https://neodigital.ca/?nonitro=1&v=" + Date.now();

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});

const page = await browser.newPage();
await page.goto(TARGET_URL, { waitUntil: "networkidle2", timeout: 90000 });

// 1. Verify Desktop Metrics
const desktopMetrics = await page.evaluate(() => {
  const ctaCard = document.querySelector(".neo-footer-cta-card");
  const ctaTitle = document.querySelector(".neo-cta-title");
  const ctaBtn = document.querySelector(".neo-cta-arrow-btn");
  const strip = document.querySelector(".neo-footer-strip");
  const aboutCol = document.querySelector(".neo-col-about");
  const servicesCol = document.querySelector(".neo-col-services");
  const quickCol = document.querySelector(".neo-col-quicklinks");
  const connectCol = document.querySelector(".neo-col-connect");
  const moneyLinks = Array.from(document.querySelectorAll(".neo-footer-strip a[href*='edmonton-seo'], .neo-footer-strip a[href*='website-design'], .neo-footer-strip a[href*='elementor-help'], .neo-footer-strip a[href*='local-seo'], .neo-footer-strip a[href*='aiseo'], .neo-footer-strip a[href*='google-ads']")).map(a => a.href);

  const ctaRect = ctaCard ? ctaCard.getBoundingClientRect() : null;
  const titleRect = ctaTitle ? ctaTitle.getBoundingClientRect() : null;
  const btnRect = ctaBtn ? ctaBtn.getBoundingClientRect() : null;
  const stripRect = strip ? strip.getBoundingClientRect() : null;

  return {
    ctaPresent: !!ctaCard,
    ctaHeight: ctaRect ? ctaRect.height : 0,
    ctaWidth: ctaRect ? ctaRect.width : 0,
    ctaTitleText: ctaTitle ? ctaTitle.textContent.trim() : null,
    ctaTitleHeight: titleRect ? titleRect.height : 0,
    ctaTitleWidth: titleRect ? titleRect.width : 0,
    ctaBtnWidth: btnRect ? btnRect.width : 0,
    ctaBtnHeight: btnRect ? btnRect.height : 0,
    stripPresent: !!strip,
    stripHeight: stripRect ? stripRect.height : 0,
    columnsFound: {
      about: !!aboutCol,
      services: !!servicesCol,
      quicklinks: !!quickCol,
      connect: !!connectCol,
    },
    moneyLinksCount: moneyLinks.length,
    moneyLinks: [...new Set(moneyLinks)],
  };
});

// Scroll to footer and screenshot desktop
const footerHandle = await page.$(".site-footer");
if (footerHandle) {
  await footerHandle.scrollIntoView();
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({
    path: "b:/Neo Pulse/tmp/footer-desktop.png",
    clip: await footerHandle.boundingBox(),
  });
}

// 2. Mobile Viewport (390x844 iPhone 12)
await page.setViewport({ width: 390, height: 844 });
await new Promise(r => setTimeout(r, 1000));

const mobileMetrics = await page.evaluate(() => {
  const ctaCard = document.querySelector(".neo-footer-cta-card");
  const strip = document.querySelector(".neo-footer-strip");
  const ctaRect = ctaCard ? ctaCard.getBoundingClientRect() : null;
  const stripRect = strip ? strip.getBoundingClientRect() : null;
  return {
    ctaHeightMobile: ctaRect ? ctaRect.height : 0,
    stripHeightMobile: stripRect ? stripRect.height : 0,
    bodyScrollWidth: document.body.scrollWidth,
    windowInnerWidth: window.innerWidth,
    hasHorizontalOverflow: document.body.scrollWidth > window.innerWidth,
  };
});

const mobileFooter = await page.$(".site-footer");
if (mobileFooter) {
  await mobileFooter.scrollIntoView();
  await new Promise(r => setTimeout(r, 1000));
  await page.screenshot({
    path: "b:/Neo Pulse/tmp/footer-mobile.png",
    clip: await mobileFooter.boundingBox(),
  });
}

await browser.close();

console.log(JSON.stringify({ desktopMetrics, mobileMetrics }, null, 2));
