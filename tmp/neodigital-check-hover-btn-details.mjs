import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/website-design/?nonitro=1", { waitUntil: "networkidle2" });

const hoverTrace = await page.evaluate(() => {
  const btn = document.querySelector(".elementor-element-6eb27dc1 a.ygency-button");
  if (!btn) return "btn not found";

  const defaultStyles = {
    bg: window.getComputedStyle(btn).backgroundColor,
    color: window.getComputedStyle(btn).color,
    border: window.getComputedStyle(btn).borderColor,
    beforeBg: window.getComputedStyle(btn, "::before").backgroundColor,
    beforeWidth: window.getComputedStyle(btn, "::before").width,
  };

  // Find all CSS rules matching this button
  const rules = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules || [])) {
        if (rule.selectorText && (rule.selectorText.includes("6eb27dc1") || (rule.selectorText.includes("ygency-button") && rule.selectorText.includes("hover")))) {
          rules.push({ selector: rule.selectorText, cssText: rule.cssText });
        }
      }
    } catch (e) {}
  }

  return { defaultStyles, rules };
});

const btn = await page.$(".elementor-element-6eb27dc1 a.ygency-button");
if (btn) {
  await btn.hover();
  await new Promise(r => setTimeout(r, 600));

  const afterHover = await page.evaluate(() => {
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
      beforeOpacity: window.getComputedStyle(b, "::before").opacity,
      afterBg: window.getComputedStyle(b, "::after").backgroundColor,
      afterWidth: window.getComputedStyle(b, "::after").width,
    };
  });
  console.log("After Hover:", afterHover);

  await page.screenshot({ path: "b:/Neo Pulse/tmp/btn-hovered-real.png" });
}

await browser.close();
console.log("Hover Trace:", JSON.stringify(hoverTrace, null, 2));
