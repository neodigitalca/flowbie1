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
  page.on("pageerror", (err) => console.log("PAGEERR", String(err).slice(0, 200)));
  await page.goto("https://neodigital.ca/", { waitUntil: "networkidle2", timeout: 90_000 });
  const home = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll("section, .elementor-section, .e-con, .swiper, .elementor-widget")];
    return nodes
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          cls: String(el.className).slice(0, 80),
          h: Math.round(r.height),
          w: Math.round(r.width),
          text: el.innerText.trim().slice(0, 40),
          imgs: el.querySelectorAll("img").length,
        };
      })
      .filter((n) => n.h >= 280 && n.w > 200)
      .slice(0, 16);
  });
  console.log("HOME tall", JSON.stringify(home, null, 2));
} finally {
  await browser.close();
}
