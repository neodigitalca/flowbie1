import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const report = await page.evaluate(() => {
  // Find leaf element containing "We pride ourselves"
  const leaves = Array.from(document.querySelectorAll("*")).filter(el => {
    return el.children.length === 0 && el.textContent.includes("We pride ourselves");
  });
  
  return leaves.map(el => {
    const s = window.getComputedStyle(el);
    return {
      tagName: el.tagName,
      className: el.className,
      text: el.textContent.trim(),
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing,
      color: s.color,
      matchedRules: []
    };
  });
});

console.log("LEAF NODES:", JSON.stringify(report, null, 2));

// Also let's find the leaf for "We not only make it look pretty"
const introLeaf = await page.evaluate(() => {
  const leaves = Array.from(document.querySelectorAll("*")).filter(el => {
    return el.children.length === 0 && el.textContent.includes("creating websites that function flawlessly");
  });
  return leaves.map(el => {
    const s = window.getComputedStyle(el);
    return {
      tagName: el.tagName,
      className: el.className,
      text: el.textContent.trim(),
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      lineHeight: s.lineHeight,
      color: s.color
    };
  });
});

console.log("INTRO LEAF NODES:", JSON.stringify(introLeaf, null, 2));

await browser.close();
