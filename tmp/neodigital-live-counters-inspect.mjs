import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/?nonitro=1&v=counters", {
  waitUntil: "networkidle2",
  timeout: 90000,
});

const report = await page.evaluate(() => {
  const digits = document.querySelectorAll(".qodef-m-digit, .qodef-m-digit-label, .qodef-qi-counter");
  return [...digits].map((el) => {
    const cs = getComputedStyle(el);
    return {
      cls: el.className,
      text: el.textContent.trim(),
      color: cs.color,
      webkitTextStroke: cs.webkitTextStroke,
      webkitTextFillColor: cs.webkitTextFillColor,
      fill: cs.fill,
    };
  });
});

await browser.close();
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
