import {
  launchBrowserWithResidentialProxy,
  isProxyConfigured,
  resolveResidentialProxyEnv,
} from "../../scripts/research/residential-proxy/lib.mjs";

if (!isProxyConfigured()) {
  console.error("no proxy");
  process.exit(1);
}

const pages = [
  ["https://neodigital.ca/", "tmp/pagespeed/home-guest.png"],
  ["https://neodigital.ca/local-seo/", "tmp/pagespeed/local-seo-guest.png"],
  ["https://neodigital.ca/about/", "tmp/pagespeed/about-guest.png"],
];

const { browser, page } = await launchBrowserWithResidentialProxy({
  headed: false,
  env: resolveResidentialProxyEnv(),
});
try {
  for (const [url, file] of pages) {
    const bad = [];
    const onRes = (res) => {
      const u = res.url();
      if (u.includes("/cache/neo-pulse-speed/") && res.status() >= 400) bad.push(u);
    };
    page.on("response", onRes);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 90_000 });
    page.off("response", onRes);
    await page.screenshot({ path: file, fullPage: false });
    const dead = (await page.content()).includes("bc79f1542aa02f26e4a8b434c5c14bce") || (await page.content()).includes("df8c486568f4433810545ed91d3adc78");
    console.log(url, "404s", bad.length, "deadHashes", dead, "file", file);
  }
} finally {
  await browser.close();
}
