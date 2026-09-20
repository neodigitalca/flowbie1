import {
  launchBrowserWithResidentialProxy,
  isProxyConfigured,
  resolveResidentialProxyEnv,
} from "../../scripts/research/residential-proxy/lib.mjs";

if (!isProxyConfigured()) {
  console.error("no proxy");
  process.exit(1);
}

const urls = [
  "https://neodigital.ca/",
  "https://neodigital.ca/elementor-help/",
  "https://neodigital.ca/about/",
];

const { browser, page } = await launchBrowserWithResidentialProxy({
  headed: false,
  env: resolveResidentialProxyEnv(),
});

try {
  for (const url of urls) {
    const hits = [];
    const onRes = (res) => {
      const u = res.url();
      if (u.includes("/cache/neo-pulse-speed/")) {
        hits.push({ status: res.status(), url: u });
      }
    };
    page.on("response", onRes);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 90_000 }).catch((err) => {
      console.log("NAV", url, String(err).slice(0, 100));
    });
    page.off("response", onRes);
    const hrefs = await page.$$eval('link[rel="stylesheet"]', (els) => els.map((el) => el.href));
    const missing = hits.filter((h) => h.status >= 400);
    console.log("PAGE", url, "speed", hits.length, "missing", missing.length);
    for (const h of missing) console.log("  404", h.url);
    for (const h of hrefs.filter((x) => x.includes("neo-pulse-speed")).slice(0, 6)) {
      console.log("  HREF", h);
    }
  }
} finally {
  await browser.close();
}
