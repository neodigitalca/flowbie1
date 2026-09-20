import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/website-design/?nonitro=1", { waitUntil: "networkidle2" });

const ctaCon = await page.$(".elementor-element-13b99946");
if (ctaCon) {
  await ctaCon.scrollIntoView();
  await new Promise(r => setTimeout(r, 600));

  // Let's test 4 different styling variations on the live element
  const variations = [
    {
      name: "v1-translucent-dark-green-border",
      // Dark translucent frosted glass with crisp green border, lime text
      css: `
        background-color: rgba(2, 5, 10, 0.6) !important;
        border: 2px solid #84BD00 !important;
        backdrop-filter: blur(12px) !important;
        -webkit-backdrop-filter: blur(12px) !important;
        color: #FFFFFF !important;
      `,
      textColor: "#FFFFFF",
      iconColor: "#84BD00",
    },
    {
      name: "v2-translucent-green-frost",
      // Translucent green tint with frosted blur and high contrast border
      css: `
        background-color: rgba(132, 189, 0, 0.25) !important;
        border: 2px solid #84BD00 !important;
        backdrop-filter: blur(16px) !important;
        -webkit-backdrop-filter: blur(16px) !important;
        box-shadow: 0 0 25px rgba(132, 189, 0, 0.2) !important;
        color: #FFFFFF !important;
      `,
      textColor: "#FFFFFF",
      iconColor: "#FFFFFF",
    },
    {
      name: "v3-frosted-glass-green-accent",
      // Modern frosted glass with lime green border and lime green text/icon
      css: `
        background-color: rgba(255, 255, 255, 0.08) !important;
        border: 2px solid #84BD00 !important;
        backdrop-filter: blur(16px) !important;
        -webkit-backdrop-filter: blur(16px) !important;
        box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37) !important;
      `,
      textColor: "#FFFFFF",
      iconColor: "#84BD00",
    },
    {
      name: "v4-semi-transparent-green-strong",
      // 50% opacity vibrant green so you see through to the white letters, but green is very prominent
      css: `
        background-color: rgba(132, 189, 0, 0.45) !important;
        border: 2px solid #84BD00 !important;
        backdrop-filter: blur(8px) !important;
        -webkit-backdrop-filter: blur(8px) !important;
      `,
      textColor: "#02050A",
      iconColor: "#02050A",
    }
  ];

  for (const v of variations) {
    await page.evaluate((v) => {
      const btn = document.querySelector(".elementor-element-6eb27dc1 a.ygency-button");
      if (!btn) return;
      btn.style.cssText += v.css;
      const text = btn.querySelector(".button-text");
      const icon = btn.querySelector(".button-icon i");
      if (text) text.style.cssText = `color: ${v.textColor} !important; font-weight: 700 !important;`;
      if (icon) icon.style.cssText = `color: ${v.iconColor} !important; font-weight: 700 !important;`;
    }, v);

    await new Promise(r => setTimeout(r, 400));
    await page.screenshot({ path: `b:/Neo Pulse/tmp/${v.name}.png` });
  }
}

await browser.close();
console.log("Variations generated!");
