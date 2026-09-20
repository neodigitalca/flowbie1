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
  await page.goto("https://neodigital.ca/", { waitUntil: "domcontentloaded", timeout: 90_000 });
  const first = await page.evaluate(() => {
    const btn = document.getElementById("neo-pulse-chat-mobile-launcher");
    if (!btn) return { present: false };
    const r = btn.getBoundingClientRect();
    return {
      present: true,
      hidden: btn.hasAttribute("hidden"),
      pending: btn.classList.contains("fcw-launcher--pending"),
      w: Math.round(r.width),
      h: Math.round(r.height),
      text: (btn.textContent || "").replace(/\s+/g, " ").trim(),
    };
  });
  console.log("first", JSON.stringify(first));
  await new Promise((resolve) => setTimeout(resolve, 5500));
  const later = await page.evaluate(() => {
    const btn = document.getElementById("neo-pulse-chat-mobile-launcher");
    if (!btn) return { present: false };
    const r = btn.getBoundingClientRect();
    return {
      present: true,
      hidden: btn.hasAttribute("hidden"),
      pending: btn.classList.contains("fcw-launcher--pending"),
      w: Math.round(r.width),
      h: Math.round(r.height),
      text: (btn.textContent || "").replace(/\s+/g, " ").trim(),
    };
  });
  console.log("later", JSON.stringify(later));
} finally {
  await browser.close();
}
