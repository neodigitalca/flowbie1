import {
  launchBrowserWithResidentialProxy,
  isProxyConfigured,
  resolveResidentialProxyEnv,
} from "../../scripts/research/residential-proxy/lib.mjs";

if (!isProxyConfigured()) {
  console.error("no proxy");
  process.exit(1);
}

const { browser, page } = await launchBrowserWithResidentialProxy({
  headed: false,
  env: resolveResidentialProxyEnv(),
});

try {
  const hits = [];
  page.on("response", (res) => {
    const u = res.url();
    if ((u.includes("jquery") || u.includes("swiper") || u.includes("elementor") || u.includes("neo-pulse-speed")) && res.status() >= 400) {
      hits.push(`${res.status()} ${u}`);
    }
  });
  await page.goto("https://neodigital.ca/?nocache=1", { waitUntil: "networkidle2", timeout: 90_000 });
  const report = await page.evaluate(() => {
    const el = document.querySelector(".elementor-element-b99bc95");
    const cs = el ? getComputedStyle(el) : null;
    const scripts = [...document.querySelectorAll("script[src]")].map((s) => s.src);
    return {
      hasEl: Boolean(el),
      minH: cs?.minHeight,
      height: cs?.height,
      pos: cs?.position,
      display: cs?.display,
      overflow: cs?.overflow,
      jq: typeof window.jQuery,
      swiper: typeof window.Swiper,
      scripts: scripts.filter((s) => /jquery|swiper|waypoint|elementor-frontend/i.test(s)),
      speedCss: [...document.querySelectorAll('link[rel="stylesheet"]')]
        .map((l) => l.href)
        .filter((h) => h.includes("neo-pulse-speed")),
    };
  });
  console.log(JSON.stringify({ hits, report }, null, 2));
  await page.screenshot({ path: "tmp/pagespeed/home-after-repair.png", fullPage: false });
} finally {
  await browser.close();
}
