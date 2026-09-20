import puppeteer from "puppeteer";

const URL = `https://neodigital.ca/?nonitro=1&v=oneline-${Date.now()}`;
const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto(URL, { waitUntil: "networkidle2", timeout: 90000 });
await page.waitForSelector(".ygency-info-box .title-text", { timeout: 30000 });

const titles = await page.evaluate(() => {
  return [...document.querySelectorAll(".ygency-info-box")].map((box) => {
    const title = box.querySelector(".title-text");
    if (!title) return null;
    const r = title.getBoundingClientRect();
    const cs = getComputedStyle(title);
    const lineH = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.25;
    return {
      text: (title.textContent || "").replace(/\s+/g, " ").trim(),
      html: title.innerHTML,
      h: Math.round(r.height),
      w: Math.round(r.width),
      lineH: Math.round(lineH),
      lines: Math.max(1, Math.round(r.height / lineH)),
      hasBr: /<br/i.test(title.innerHTML),
    };
  });
});

await browser.close();
process.stdout.write(`${JSON.stringify(titles, null, 2)}\n`);
