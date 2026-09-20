import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const fontReport = await page.evaluate(() => {
  // 1. Text with red arrow: "We pride ourselves on our competitive prices..."
  // Find element containing "We pride ourselves"
  const allElements = Array.from(document.querySelectorAll("*"));
  const target = allElements.find(el => el.children.length === 0 && el.innerText && el.innerText.includes("We pride ourselves"));
  const targetStyles = target ? window.getComputedStyle(target) : null;

  // 2. Crossed out: "We know how Edmonton searches..."
  const crossed1 = allElements.find(el => el.children.length === 0 && el.innerText && el.innerText.includes("We know how Edmonton searches"));
  const crossed1Styles = crossed1 ? window.getComputedStyle(crossed1) : null;

  // 3. Crossed out: "With current local ranking factors..."
  const crossed2 = allElements.find(el => el.children.length === 0 && el.innerText && el.innerText.includes("With current local ranking factors"));
  const crossed2Styles = crossed2 ? window.getComputedStyle(crossed2) : null;

  // 4. Crossed out: "We not only make it look pretty..." or "We run local pack work"
  const crossed3 = allElements.find(el => el.children.length === 0 && el.innerText && el.innerText.includes("We run local pack work"));
  const crossed3Styles = crossed3 ? window.getComputedStyle(crossed3) : null;

  const extract = (el, s) => {
    if (!el || !s) return null;
    return {
      text: el.innerText.slice(0, 50),
      tag: el.tagName,
      class: el.className,
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing,
      textTransform: s.textTransform,
      color: s.color,
    };
  };

  return {
    goodArrowTarget: extract(target, targetStyles),
    badCrossed1: extract(crossed1, crossed1Styles),
    badCrossed2: extract(crossed2, crossed2Styles),
    badCrossed3: extract(crossed3, crossed3Styles),
  };
});

console.log("FONT REPORT:", JSON.stringify(fontReport, null, 2));

await browser.close();
