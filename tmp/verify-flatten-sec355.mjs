import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2" });

const sec = await page.$(".elementor-element-3553037");
if (sec) {
  await sec.scrollIntoView();
  await new Promise(r => setTimeout(r, 800));
  await sec.screenshot({ path: "tmp/sec-3553037-after-flatten.png" });
}

const colors = await page.evaluate(() => {
  const getStyle = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const p = el.querySelector("p, h1, h2, span") || el;
    const c = window.getComputedStyle(p);
    return { text: p.innerText?.slice(0, 40), color: c.color, fontSize: c.fontSize };
  };

  return {
    secTitle: getStyle(".elementor-element-4b39b50"),
    secDesc: getStyle(".elementor-element-ba7052d"),
    num150: getStyle(".elementor-element-a75aad3"),
    localCamp: getStyle(".elementor-element-e2ce6fe"),
    weKeep: getStyle(".elementor-element-9474c98"),
    stratTitle: getStyle(".elementor-element-859fe91"),
    stratDesc: getStyle(".elementor-element-7364af0"),
    plus: getStyle(".elementor-element-bbdcc6b"),
    customCamp: getStyle(".elementor-element-79b72fd")
  };
});

console.log("AFTER FLATTEN COLORS:", JSON.stringify(colors, null, 2));

await browser.close();
