import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const fontReport = await page.evaluate(async () => {
  // Check loaded fonts
  const loadedFonts = [];
  for (const font of document.fonts) {
    loadedFonts.push({
      family: font.family,
      weight: font.weight,
      status: font.status
    });
  }

  // Check link tags
  const links = Array.from(document.querySelectorAll("link[rel='stylesheet']")).map(l => l.href);
  const latoLinks = links.filter(l => l && l.toLowerCase().includes("lato"));

  // Check the element
  const p = document.querySelector(".elementor-element-ba7052d p") || document.querySelector(".elementor-element-ba7052d");
  const s = window.getComputedStyle(p);

  return {
    latoLinks,
    loadedFonts: loadedFonts.filter(f => f.family.toLowerCase().includes("lato") || f.family.toLowerCase().includes("roboto")),
    elementStyles: {
      fontFamily: s.fontFamily,
      fontWeight: s.fontWeight,
      fontSize: s.fontSize,
      fontStyle: s.fontStyle
    }
  };
});

console.log("FONT REPORT:", JSON.stringify(fontReport, null, 2));

await browser.close();
