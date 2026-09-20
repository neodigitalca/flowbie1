import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const report = await page.evaluate(() => {
  const leaves = Array.from(document.querySelectorAll("*")).filter(el => {
    return el.children.length === 0 && el.textContent.includes("creating websites that function flawlessly");
  });
  const target = leaves[0];
  if (!target) return null;

  const chain = [];
  let curr = target;
  while (curr && curr !== document.documentElement) {
    const s = window.getComputedStyle(curr);
    chain.push({
      tag: curr.tagName,
      id: curr.id,
      className: curr.className,
      fontWeight: s.fontWeight,
      fontSize: s.fontSize,
      fontFamily: s.fontFamily,
      inlineStyle: curr.getAttribute("style") || ""
    });
    curr = curr.parentElement;
  }

  // Also check all CSS rules that contain font-weight: 600 or 600 in all sheets
  const rules600 = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules || [])) {
        if (rule.style && (rule.style.fontWeight === "600" || rule.style.fontWeight === "bold")) {
          rules600.push({
            selector: rule.selectorText,
            fontWeight: rule.style.fontWeight,
            cssText: rule.cssText.slice(0, 150),
            href: sheet.href ? sheet.href.split("/").slice(-2).join("/") : "inline"
          });
        }
      }
    } catch (e) {}
  }

  return { chain, rules600: rules600.slice(0, 20) };
});

console.log("CHAIN:", JSON.stringify(report.chain, null, 2));
console.log("RULES 600 (first 20):", JSON.stringify(report.rules600, null, 2));

await browser.close();
