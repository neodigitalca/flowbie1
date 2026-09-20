import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();

for (const url of ["https://neodigital.ca/edmonton-seo/", "https://neodigital.ca/"]) {
  console.log(`\n=== SCANNING LIVE: ${url} ===`);
  await page.goto(url + "?v=" + Date.now(), { waitUntil: "networkidle2" });

  const paragraphs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("p")).map(p => {
      const s = window.getComputedStyle(p);
      return {
        text: p.innerText?.trim().slice(0, 45),
        fontFamily: s.fontFamily,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        color: s.color
      };
    }).filter(item => item.text && item.text.length > 3);
  });

  const outliers = paragraphs.filter(p => {
    return !p.fontFamily.includes("Lato") || p.fontWeight !== "400" || p.fontSize !== "24px";
  });

  console.log(`Total paragraphs found: ${paragraphs.length}`);
  console.log(`Outliers: ${outliers.length}`);
}

await browser.close();
