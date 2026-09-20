import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const report = await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll("link")).map(l => l.href);
  const fonts = Array.from(document.fonts).map(f => ({ family: f.family, status: f.status, weight: f.weight }));
  return {
    links: links.filter(l => l && l.includes("fonts")),
    latoFonts: fonts.filter(f => f.family.toLowerCase().includes("lato"))
  };
});

console.log("HOMEPAGE FONTS:", JSON.stringify(report, null, 2));

await browser.close();
