import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();

// 1. Check Home Counters & CTA
await page.goto("https://neodigital.ca/?nonitro=1&v=verify_kit1", {
  waitUntil: "networkidle2",
  timeout: 90000,
});

const homeChecks = await page.evaluate(() => {
  const digits = [...document.querySelectorAll(".qodef-m-digit")].map((el) => {
    const cs = getComputedStyle(el);
    return {
      text: el.textContent.trim(),
      color: cs.color,
      fill: cs.webkitTextFillColor,
      stroke: cs.webkitTextStroke,
    };
  });

  const ctaBtn = document.querySelector(".ygency-button.icon-top");
  const ctaCs = ctaBtn ? getComputedStyle(ctaBtn) : null;
  const ctaInfo = ctaBtn
    ? {
        bg: ctaCs.backgroundColor,
        color: ctaCs.color,
        border: ctaCs.border,
      }
    : null;

  return { digits, ctaInfo };
});

// 2. Check Our Services
await page.goto("https://neodigital.ca/our-services/?nonitro=1&v=verify_kit2", {
  waitUntil: "networkidle2",
  timeout: 90000,
});

const servicesChecks = await page.evaluate(() => {
  const p = document.querySelector(".ygency-feature-box .box-desc");
  const cs = p ? getComputedStyle(p) : null;
  return p
    ? {
        text: p.textContent.slice(0, 30),
        color: cs.color,
        fontSize: cs.fontSize,
        fontFamily: cs.fontFamily,
      }
    : null;
});

await browser.close();
process.stdout.write(`${JSON.stringify({ homeChecks, servicesChecks }, null, 2)}\n`);
