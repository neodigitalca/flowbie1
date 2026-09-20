import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const report = await page.evaluate(() => {
  const allElements = Array.from(document.querySelectorAll("*"));
  const target = allElements.find(el => el.innerText && el.innerText.includes("We pride ourselves on our competitive prices"));
  const targetP = target ? (target.querySelector("p") || target) : null;
  const s = targetP ? window.getComputedStyle(targetP) : null;

  const intro = allElements.find(el => el.innerText && el.innerText.includes("We not only make it look pretty"));
  const introP = intro ? (intro.querySelector("p") || intro) : null;
  const introS = introP ? window.getComputedStyle(introP) : null;

  return {
    competitiveRates: s ? {
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      lineHeight: s.lineHeight,
      color: s.color,
      outerHTML: targetP.outerHTML.slice(0, 200)
    } : null,
    introFlawlessly: introS ? {
      fontFamily: introS.fontFamily,
      fontSize: introS.fontSize,
      fontWeight: introS.fontWeight,
      lineHeight: introS.lineHeight,
      color: introS.color,
      outerHTML: introP.outerHTML.slice(0, 200)
    } : null
  };
});

console.log("HOMEPAGE FONT REPORT:", JSON.stringify(report, null, 2));

await browser.close();
