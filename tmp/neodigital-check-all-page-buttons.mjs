import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1", { waitUntil: "networkidle2" });

const buttons = await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll("a, button")).filter(el => {
    const cls = el.className || "";
    return cls.includes("btn") || cls.includes("button") || el.getAttribute("role") === "button";
  });

  return btns.map(b => {
    const cs = window.getComputedStyle(b);
    return {
      text: b.textContent.trim(),
      className: b.className,
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      border: cs.border,
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      rect: b.getBoundingClientRect(),
    };
  });
});

await browser.close();
console.log(JSON.stringify(buttons, null, 2));
