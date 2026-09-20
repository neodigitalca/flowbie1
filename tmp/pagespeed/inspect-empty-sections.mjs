/**
 * Dump tall empty sections and asset errors on key neodigital.ca URLs.
 */
import {
  launchBrowserWithResidentialProxy,
  isProxyConfigured,
  resolveResidentialProxyEnv,
} from "../../scripts/research/residential-proxy/lib.mjs";

const urls = [
  "https://neodigital.ca/",
  "https://neodigital.ca/about/",
  "https://neodigital.ca/local-seo/",
];

if (!isProxyConfigured()) {
  console.error("no proxy");
  process.exit(1);
}

const { browser, page } = await launchBrowserWithResidentialProxy({
  headed: false,
  env: resolveResidentialProxyEnv(),
});

try {
  for (const url of urls) {
    const hits = [];
    const errors = [];
    const onRes = (res) => {
      const u = res.url();
      const cssJs = u.includes(".css") || u.includes(".js");
      if (cssJs && res.status() >= 400) hits.push(`${res.status()} ${u}`);
    };
    page.on("response", onRes);
    page.on("pageerror", (err) => errors.push(String(err).slice(0, 200)));
    await page.goto(url, { waitUntil: "networkidle2", timeout: 90_000 }).catch((err) => {
      console.log("NAV", url, String(err).slice(0, 100));
    });
    page.off("response", onRes);
    const report = await page.evaluate(() => {
      const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')].map((el) => el.href);
      const empty = [...document.querySelectorAll("section, .elementor-section, .e-con")]
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName,
            cls: String(el.className).slice(0, 120),
            h: Math.round(r.height),
            w: Math.round(r.width),
            text: el.innerText.trim().slice(0, 50),
          };
        })
        .filter((n) => n.h >= 400 && n.w > 200 && n.text.length < 12)
        .slice(0, 12);
      return {
        title: document.title,
        bodyH: document.body ? document.body.scrollHeight : 0,
        swiper: typeof window.Swiper,
        jq: typeof window.jQuery,
        waypoint: typeof window.Waypoint,
        speedCss: sheets.filter((h) => h.includes("neo-pulse-speed")).length,
        elementorCss: sheets.filter((h) => h.includes("elementor")).length,
        missingHashes: sheets.filter((h) => h.includes("bc79f1542aa02f26e4a8b434c5c14bce") || h.includes("df8c486568f4433810545ed91d3adc78")),
        empty,
      };
    });
    console.log("PAGE", url, report.title);
    console.log("  bodyH", report.bodyH, "swiper", report.swiper, "jq", report.jq, "waypoint", report.waypoint, "speedCss", report.speedCss, "elementorCss", report.elementorCss);
    console.log("  missingHashes", report.missingHashes);
    for (const h of hits.slice(0, 8)) console.log("  404", h);
    for (const e of errors.slice(0, 6)) console.log("  ERR", e);
    console.log("  empty", JSON.stringify(report.empty, null, 2));
  }
} finally {
  await browser.close();
}
