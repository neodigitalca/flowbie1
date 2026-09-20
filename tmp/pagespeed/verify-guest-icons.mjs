import {
  launchBrowserWithResidentialProxy,
  isProxyConfigured,
  resolveResidentialProxyEnv,
} from "../../scripts/research/residential-proxy/lib.mjs";

const pages = [
  "https://neodigital.ca/",
  "https://neodigital.ca/elementor-help/",
  "https://neodigital.ca/about/",
  "https://neodigital.ca/edmonton-seo/",
  "https://neodigital.ca/contact/",
];

if (!isProxyConfigured()) {
  console.error("no proxy");
  process.exit(1);
}

const { browser, page } = await launchBrowserWithResidentialProxy({
  headed: false,
  env: resolveResidentialProxyEnv(),
});

let failed = 0;
try {
  for (const url of pages) {
    const fonts = [];
    const onRes = (res) => {
      const u = res.url();
      if (
        u.includes(".woff") ||
        u.includes(".ttf") ||
        u.includes(".eot") ||
        u.includes("fontawesome") ||
        u.includes("flaticon") ||
        u.includes("webfonts")
      ) {
        fonts.push({ url: u, status: res.status() });
      }
    };
    page.on("response", onRes);
    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 90_000 });
    } catch (err) {
      console.log("NAV", url, String(err).slice(0, 160));
    }
    page.off("response", onRes);
    const hrefs = await page
      .$$eval('link[rel="stylesheet"]', (els) => els.map((el) => el.href).filter(Boolean))
      .catch(() => []);
    const icons = await page
      .evaluate(() => {
        const nodes = [...document.querySelectorAll("i.fa, i.fas, i.far, i.fal, i.fab, i.eicon, [class*='fa-']")].slice(0, 6);
        return {
          title: document.title,
          count: document.querySelectorAll("i.fa, i.fas, i.far, i.fal, i.fab, i.eicon, [class*='fa-']").length,
          sample: nodes.map((el) => {
            const before = getComputedStyle(el, "::before");
            return {
              className: String(el.className).slice(0, 50),
              content: (before.content || "").slice(0, 24),
              family: (before.fontFamily || "").slice(0, 70),
            };
          }),
        };
      })
      .catch(() => ({ title: "", count: 0, sample: [] }));
    const cacheFonts = fonts.filter((f) => f.url.includes("/cache/neo-pulse-speed/") && f.url.includes(".woff"));
    const nitroFonts = fonts.filter((f) => f.url.includes("nitropack_static") && (f.url.includes(".woff") || f.url.includes("font")));
    const bad = fonts.filter((f) => f.status >= 400);
    if (cacheFonts.length || nitroFonts.length || bad.length || icons.title === "") {
      failed += 1;
    }
    console.log("PAGE", url, icons.title);
    console.log(
      "  css",
      hrefs.filter((h) => h.includes("neo-pulse-speed") || h.includes("font") || h.includes("flaticon")).slice(0, 8)
    );
    console.log("  icons", icons.count, "fonts_ok", fonts.filter((f) => f.status < 400).length, "fonts_bad", bad.length, "cache_font_reqs", cacheFonts.length, "nitro_font_reqs", nitroFonts.length);
    for (const f of [...cacheFonts, ...nitroFonts, ...bad].slice(0, 8)) {
      console.log("  FONT", f.status, f.url);
    }
    for (const s of icons.sample) {
      console.log("  ICON", s.className, s.content, s.family);
    }
  }
} finally {
  await browser.close();
}

process.exit(failed > 0 ? 1 : 0);
