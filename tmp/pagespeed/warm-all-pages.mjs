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

function locUrls(xml) {
  const out = [];
  const parts = String(xml).split("<loc>");
  for (let i = 1; i < parts.length; i += 1) {
    const end = parts[i].indexOf("</loc>");
    if (end > 0) out.push(parts[i].slice(0, end).trim());
  }
  return out;
}

try {
  await page.goto("https://neodigital.ca/sitemap.xml", { waitUntil: "domcontentloaded", timeout: 90_000 });
  const xml = await page.evaluate(() => document.body?.innerText || document.documentElement?.textContent || "");
  let urls = locUrls(xml).filter((u) => u.includes("neodigital.ca"));
  const indexKids = urls.filter((u) => u.includes(".xml"));
  for (const child of indexKids.slice(0, 8)) {
    try {
      await page.goto(child, { waitUntil: "domcontentloaded", timeout: 60_000 });
      const childXml = await page.evaluate(() => document.body?.innerText || "");
      urls.push(...locUrls(childXml));
    } catch (err) {
      console.log("smap", child, String(err).slice(0, 80));
    }
  }
  urls = [...new Set(urls.filter((u) => u.startsWith("https://neodigital.ca/") && !u.endsWith(".xml")))];
  if (!urls.includes("https://neodigital.ca/")) urls.unshift("https://neodigital.ca/");
  console.log("pages", urls.length);
  let missing = 0;
  for (const url of urls) {
    const bad = [];
    const onRes = (res) => {
      const u = res.url();
      if (u.includes("/cache/neo-pulse-speed/") && res.status() >= 400) bad.push(u);
    };
    page.on("response", onRes);
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 15_000 }).catch(() => {});
    } catch (err) {
      console.log("NAV", url, String(err).slice(0, 80));
    }
    page.off("response", onRes);
    if (bad.length) {
      missing += 1;
      console.log("MISS", bad.length, url);
    } else {
      console.log("OK", url);
    }
  }
  console.log("done pages", urls.length, "with_404", missing);
  process.exit(missing > 0 ? 1 : 0);
} finally {
  await browser.close();
}
