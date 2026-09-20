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
    if ((u.includes("elementor") || u.includes(".css")) && res.status() >= 400) {
      hits.push(`${res.status()} ${u}`);
    }
  });
  await page.goto("https://neodigital.ca/local-seo/", { waitUntil: "networkidle2", timeout: 90_000 });
  const report = await page.evaluate(() => {
    const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')].map((el) => el.href);
    const text = (document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 400);
    return {
      title: document.title,
      bodyH: document.body?.scrollHeight,
      text,
      elementorCss: sheets.filter((h) => h.includes("elementor")),
      postCss: sheets.filter((h) => h.includes("post-") && h.includes(".css")),
    };
  });
  console.log(JSON.stringify({ hits, report }, null, 2));
  await page.screenshot({ path: "tmp/pagespeed/local-seo-full.png", fullPage: true });
} finally {
  await browser.close();
}
