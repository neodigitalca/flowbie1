import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const report = await page.evaluate(() => {
  const allP = Array.from(document.querySelectorAll("p")).filter(p => {
    return p.textContent.includes("We run local pack work") || p.textContent.includes("creating websites that function flawlessly");
  });

  return allP.map(p => {
    const s = window.getComputedStyle(p);
    return {
      text: p.textContent.trim(),
      tagName: p.tagName,
      className: p.className,
      parentElement: {
        tagName: p.parentElement.tagName,
        className: p.parentElement.className,
        id: p.parentElement.id,
        dataId: p.parentElement.getAttribute("data-id")
      },
      fontFamily: s.fontFamily,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      lineHeight: s.lineHeight,
      color: s.color,
      matchedRules: Array.from(document.styleSheets).flatMap(sheet => {
        try {
          return Array.from(sheet.cssRules || []).filter(r => r.selectorText && p.matches(r.selectorText)).map(r => ({
            selector: r.selectorText,
            fontWeight: r.style?.fontWeight,
            fontFamily: r.style?.fontFamily,
            fontSize: r.style?.fontSize,
            cssText: r.cssText.slice(0, 150),
            href: sheet.href ? sheet.href.split("/").slice(-2).join("/") : "inline"
          }));
        } catch(e) { return []; }
      })
    };
  });
});

console.log("HOMEPAGE HERO P REPORT:", JSON.stringify(report, null, 2));

await browser.close();
