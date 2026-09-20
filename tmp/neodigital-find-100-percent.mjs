import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1", { waitUntil: "networkidle2" });

const found = await page.evaluate(() => {
  const elements = Array.from(document.querySelectorAll("*")).filter(el => {
    const text = el.textContent || "";
    return text.includes("Client Satisfaction") || text.includes("Years of Experience") || text.includes("Businesses Helped") || text.includes("100%");
  });

  return elements.map(el => ({
    tagName: el.tagName,
    className: el.className,
    text: el.textContent.trim().slice(0, 150),
    outerHtml: el.outerHTML.slice(0, 300),
  }));
});

await browser.close();
console.log(JSON.stringify(found.slice(0, 15), null, 2));
