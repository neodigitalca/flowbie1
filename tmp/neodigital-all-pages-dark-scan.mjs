import puppeteer from "puppeteer";

const URLS = [
  "https://neodigital.ca/?nonitro=1",
  "https://neodigital.ca/about/?nonitro=1",
  "https://neodigital.ca/our-services/?nonitro=1",
  "https://neodigital.ca/our-work/?nonitro=1",
  "https://neodigital.ca/contact/?nonitro=1",
  "https://neodigital.ca/edmonton-seo/?nonitro=1",
  "https://neodigital.ca/local-seo/?nonitro=1",
  "https://neodigital.ca/aiseo/?nonitro=1",
  "https://neodigital.ca/google-ads/?nonitro=1",
  "https://neodigital.ca/website-design/?nonitro=1",
];

const browser = await puppeteer.launch({
  headless: true,
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
const summary = {};

for (const url of URLS) {
  const slug = url.split("neodigital.ca/")[1].replace("/?nonitro=1", "") || "home";
  await page.goto(url, { waitUntil: "networkidle2", timeout: 90000 });
  const darks = await page.evaluate(() => {
    // find all visible text elements inside main content that have dark text
    const list = [];
    const elements = document.querySelectorAll(
      ".elementor-widget p, .elementor-widget span, .elementor-widget div, .elementor-widget h1, .elementor-widget h2, .elementor-widget h3, .elementor-widget h4, .elementor-widget h5, .elementor-widget a"
    );
    for (const el of elements) {
      if (el.children.length === 0 && el.textContent.trim().length > 4) {
        // Skip header/footer nav if not in main
        const main = el.closest(".elementor");
        if (!main) continue;
        const cs = getComputedStyle(el);
        const m = cs.color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (m) {
          const [_, r, g, b] = m.map(Number);
          // if r,g,b all < 60 (near black/dark gray) and background or body background is dark
          if (r < 70 && g < 70 && b < 70 && cs.opacity !== "0" && cs.display !== "none") {
            // Check if it's on a light container
            let bgEl = el;
            let onLight = false;
            while (bgEl && bgEl !== document.body) {
              const bg = getComputedStyle(bgEl).backgroundColor;
              const bgM = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
              if (bgM && (Number(bgM[1]) > 180 || Number(bgM[2]) > 180 || Number(bgM[3]) > 180)) {
                onLight = true;
                break;
              }
              bgEl = bgEl.parentElement;
            }
            if (!onLight) {
              list.push({
                tag: el.tagName,
                cls: el.className?.toString().slice(0, 50),
                text: el.textContent.trim().slice(0, 35),
                color: cs.color,
                fontSize: cs.fontSize,
                widget: el.closest(".elementor-widget")?.getAttribute("data-widget_type"),
              });
            }
          }
        }
      }
    }
    return list;
  });
  summary[slug] = { count: darks.length, samples: darks.slice(0, 10) };
}

await browser.close();
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
