import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const scrolled = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll("h1, h2, h3, h4, .title, p"));
  const target = all.find(el => el.textContent && el.textContent.includes("Aren"));
  if (target) {
    target.scrollIntoView({ block: "center" });
    return target.textContent.trim();
  }
  return null;
});

console.log("SCROLLED TO:", scrolled);
await new Promise(r => setTimeout(r, 800));
await page.screenshot({ path: "tmp/verify-homepage-why-choose-us-real.png" });

// Also let's scroll to "We not only make it look pretty"
const scrolledIntro = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll("p"));
  const target = all.find(el => el.textContent && el.textContent.includes("creating websites that function flawlessly"));
  if (target) {
    target.scrollIntoView({ block: "center" });
    return target.textContent.trim();
  }
  return null;
});

console.log("SCROLLED INTRO TO:", scrolledIntro);
await new Promise(r => setTimeout(r, 800));
await page.screenshot({ path: "tmp/verify-homepage-intro-real.png" });

await browser.close();
