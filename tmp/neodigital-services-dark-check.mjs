import puppeteer from "puppeteer";

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto("https://neodigital.ca/our-services/?nonitro=1&v=fullcheck", {
  waitUntil: "networkidle2",
  timeout: 90000,
});

const report = await page.evaluate(() => {
  const elements = document.querySelectorAll(
    ".ygency-feature-box, .ygency-feature-box *, .elementor-widget-text-editor *, .elementor-widget p, .elementor-widget a, .elementor-widget h1, .elementor-widget h2, .elementor-widget h3, .elementor-widget h4, .elementor-widget h5, .elementor-widget span"
  );
  const darks = [];
  for (const el of elements) {
    if (el.children.length === 0 && el.textContent.trim().length > 1) {
      const cs = getComputedStyle(el);
      const c = cs.color;
      // parse rgb
      const m = c.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
      if (m) {
        const [_, r, g, b] = m.map(Number);
        // if very dark (< 80, 80, 80)
        if (r < 80 && g < 80 && b < 80) {
          darks.push({
            tag: el.tagName,
            cls: el.className,
            text: el.textContent.trim().slice(0, 40),
            color: c,
            fontSize: cs.fontSize,
            fontFamily: cs.fontFamily,
            parentWidget: el.closest(".elementor-widget")?.getAttribute("data-widget_type"),
          });
        }
      }
    }
  }
  return darks;
});

await browser.close();
process.stdout.write(`${JSON.stringify({ darkCount: report.length, darks: report }, null, 2)}\n`);
