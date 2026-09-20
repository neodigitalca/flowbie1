import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1", { waitUntil: "networkidle2" });

const trace = await page.evaluate(() => {
  // Let's find any element that has text "100" or "%"
  const all100 = Array.from(document.querySelectorAll("*")).filter(el => 
    el.children.length === 0 && (el.textContent === "100" || el.textContent === "%" || el.textContent === "100%")
  );

  return all100.map(el => {
    const cs = window.getComputedStyle(el);
    return {
      text: el.textContent,
      tag: el.tagName,
      className: el.className,
      color: cs.color,
      webkitTextFillColor: cs.webkitTextFillColor,
      webkitTextStroke: cs.webkitTextStroke,
      parentClass: el.parentElement ? el.parentElement.className : null,
      grandParentClass: el.parentElement?.parentElement ? el.parentElement.parentElement.className : null,
    };
  });
});

await browser.close();
console.log(JSON.stringify(trace, null, 2));
