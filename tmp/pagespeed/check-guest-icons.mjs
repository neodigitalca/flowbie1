import {
  launchBrowserWithResidentialProxy,
  isProxyConfigured,
  resolveResidentialProxyEnv,
} from "../../scripts/research/residential-proxy/lib.mjs";

if (!isProxyConfigured()) {
  console.log("no proxy");
  process.exit(1);
}
const { browser, page } = await launchBrowserWithResidentialProxy({
  headed: false,
  env: resolveResidentialProxyEnv(),
});
try {
  await page.setViewport({ width: 1350, height: 940, deviceScaleFactor: 1, isMobile: false });
  const fonts = [];
  page.on("response", (res) => {
    const url = res.url();
    if (/\.(woff2?|ttf|eot)(\?|$)/i.test(url) || /webfonts|eicons|fontawesome|font-awesome/i.test(url)) {
      fonts.push({ status: res.status(), url: url.slice(0, 160) });
    }
  });
  await page.goto("https://neodigital.ca/elementor-help/", { waitUntil: "networkidle2", timeout: 90_000 });
  const report = await page.evaluate(() => {
    const icons = [...document.querySelectorAll("i.fa, i.fas, i.far, i.fal, i.fab, i.eicon, [class*='fa-']")].slice(0, 8);
    return {
      count: icons.length,
      sample: icons.map((el) => {
        const before = getComputedStyle(el, "::before");
        return {
          className: String(el.className).slice(0, 60),
          content: (before.content || "").slice(0, 20),
          family: (before.fontFamily || "").slice(0, 80),
        };
      }),
    };
  });
  console.log(JSON.stringify({ report, fonts: fonts.slice(0, 20) }, null, 2));
} finally {
  await browser.close();
}
