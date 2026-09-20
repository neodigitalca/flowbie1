import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/our-services/?nonitro=1&v=cards", {
  waitUntil: "networkidle2",
  timeout: 90000,
});

const cards = await page.evaluate(() => {
  const nodes = [...document.querySelectorAll(".elementor-widget")].filter((w) =>
    (w.textContent || "").includes("Web Development") || (w.textContent || "").includes("Elementor Help"),
  );
  return nodes.map((w) => {
    const elType = w.getAttribute("data-widget_type");
    const html = w.innerHTML;
    const all = [...w.querySelectorAll("*")].map((el) => {
      const cs = getComputedStyle(el);
      return {
        tag: el.tagName,
        cls: el.className,
        text: el.children.length === 0 ? el.textContent.trim().slice(0, 40) : "",
        color: cs.color,
        fontSize: cs.fontSize,
        fontFamily: cs.fontFamily,
      };
    }).filter((x) => x.text);
    return {
      widgetType: elType,
      textElements: all,
    };
  });
});

await browser.close();
process.stdout.write(`${JSON.stringify(cards, null, 2)}\n`);
