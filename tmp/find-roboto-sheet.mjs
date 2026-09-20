import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const robotoStyle = await page.evaluate(() => {
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      for (const rule of Array.from(sheet.cssRules || [])) {
        if (rule.selectorText === "body" && rule.style && rule.style.fontFamily && rule.style.fontFamily.includes("Roboto")) {
          return {
            href: sheet.href,
            ownerNode: sheet.ownerNode ? {
              tagName: sheet.ownerNode.tagName,
              id: sheet.ownerNode.id,
              className: sheet.ownerNode.className,
              outerHTML: sheet.ownerNode.outerHTML.slice(0, 300)
            } : null,
            cssText: rule.cssText
          };
        }
      }
    } catch (e) {}
  }
  return null;
});

console.log("ROBOTO SHEET:", JSON.stringify(robotoStyle, null, 2));

await browser.close();
