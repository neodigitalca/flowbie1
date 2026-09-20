import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
// Go to a page that embeds template 7605, e.g. /window-coverings-marketing/ or /website-design/ or /about/
// Let's check which page has template 7605
await page.goto("https://neodigital.ca/about/?nonitro=1", { waitUntil: "networkidle2" });

const ctaInfo = await page.evaluate(() => {
  const ctaBtn = document.querySelector(".ygency-button.icon-top");
  if (!ctaBtn) return "no icon-top button";
  const cs = window.getComputedStyle(ctaBtn);
  const textSpan = ctaBtn.querySelector(".button-text");
  const iconSpan = ctaBtn.querySelector(".button-icon");
  return {
    btnClass: ctaBtn.className,
    btnHtml: ctaBtn.outerHTML,
    btnBg: cs.backgroundColor,
    btnColor: cs.color,
    btnBorder: cs.borderColor,
    textSpanColor: textSpan ? window.getComputedStyle(textSpan).color : null,
    iconSpanColor: iconSpan ? window.getComputedStyle(iconSpan).color : null,
  };
});

console.log(ctaInfo);

// Now hover over the button
const btnHandle = await page.$(".ygency-button.icon-top");
if (btnHandle) {
  await btnHandle.hover();
  await new Promise(r => setTimeout(r, 500));
  
  const hoverStyles = await page.evaluate(() => {
    const ctaBtn = document.querySelector(".ygency-button.icon-top");
    const cs = window.getComputedStyle(ctaBtn);
    const textSpan = ctaBtn.querySelector(".button-text");
    const iconSpan = ctaBtn.querySelector(".button-icon");
    return {
      btnBg: cs.backgroundColor,
      btnColor: cs.color,
      btnBorder: cs.borderColor,
      textSpanColor: textSpan ? window.getComputedStyle(textSpan).color : null,
      iconSpanColor: iconSpan ? window.getComputedStyle(iconSpan).color : null,
    };
  });
  console.log("Hover styles:", hoverStyles);

  await page.screenshot({ path: "b:/Neo Pulse/tmp/about-cta-hover.png" });
}

await browser.close();
