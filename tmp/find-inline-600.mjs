import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const inlineStyles = await page.evaluate(() => {
  const styles = Array.from(document.querySelectorAll("style"));
  const found = [];
  for (const s of styles) {
    if (s.textContent && s.textContent.includes("font-weight: 600")) {
      found.push({
        id: s.id,
        class: s.className,
        text: s.textContent.slice(0, 400)
      });
    }
  }
  return found;
});

console.log("INLINE STYLES WITH 600:", JSON.stringify(inlineStyles, null, 2));

await browser.close();
