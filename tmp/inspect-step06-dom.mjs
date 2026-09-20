import puppeteer from "puppeteer";

const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2", timeout: 90000 });

const data = await page.evaluate(async () => {
  const row = document.querySelector(".elementor-element-b79ecfb");
  row?.scrollIntoView({ block: "center" });
  await new Promise((r) => setTimeout(r, 1500));
  if (!row) return null;
  const children = Array.from(row.children).map((c) => ({
    tag: c.tagName,
    classes: c.className.slice(0, 120),
    w: c.getBoundingClientRect().width,
    h: c.getBoundingClientRect().height,
    html: c.outerHTML.slice(0, 400),
  }));
  const imgs = Array.from(row.querySelectorAll("img")).map((img) => ({
    src: img.src.slice(-50),
    w: img.getBoundingClientRect().width,
    h: img.getBoundingClientRect().height,
    natural: { w: img.naturalWidth, h: img.naturalHeight },
    parentClass: img.parentElement?.className,
  }));
  return { children, imgs, rowH: row.getBoundingClientRect().height };
});

console.log(JSON.stringify(data, null, 2));
await page.screenshot({ path: "tmp/step06-dom.png" });
await browser.close();
