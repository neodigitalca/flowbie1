import {
  launchBrowserWithResidentialProxy,
  isProxyConfigured,
  resolveResidentialProxyEnv,
} from "../../scripts/research/residential-proxy/lib.mjs";

const url = "https://neodigital.ca/";
const useProxy = isProxyConfigured();
const launched = useProxy
  ? await launchBrowserWithResidentialProxy({ headed: false, env: resolveResidentialProxyEnv() })
  : null;
if (!launched) {
  console.log("no proxy");
  process.exit(1);
}
const { browser, page } = launched;
try {
  await page.setViewport({ width: 1350, height: 940, deviceScaleFactor: 1, isMobile: false });
  await page.goto(url, { waitUntil: "networkidle2", timeout: 90_000 });
  const report = await page.evaluate(() => {
    const named = (el) => {
      const aria = (el.getAttribute("aria-label") || "").trim();
      if (aria) return aria;
      const labelled = el.getAttribute("aria-labelledby");
      if (labelled) {
        const t = labelled.split(/\s+/).map((id) => document.getElementById(id)?.textContent || "").join(" ");
        if (t.trim()) return t.trim();
      }
      const imgs = [...el.querySelectorAll("img")].map((img) => img.getAttribute("alt") || "").join(" ");
      if (imgs.trim()) return imgs.trim();
      return (el.textContent || "").replace(/\s+/g, " ").trim();
    };
    const unnamed = [...document.querySelectorAll("button, [role=button], a")].filter((el) => named(el) === "").map((el) => ({
      tag: el.tagName,
      className: String(el.className).slice(0, 80),
      href: el.getAttribute("href") || "",
    }));
    const contrastHits = [];
    const nodes = [...document.querySelectorAll("p, a, span, li, h1, h2, h3, h4, button")].slice(0, 200);
    const parse = (c) => {
      const m = String(c).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
    };
    const lin = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    for (const el of nodes) {
      const st = getComputedStyle(el);
      if (st.visibility === "hidden" || st.display === "none") continue;
      const fg = parse(st.color);
      let bgEl = el;
      let bg = null;
      while (bgEl && !bg) {
        const c = parse(getComputedStyle(bgEl).backgroundColor);
        if (c && !(c[0] === 0 && c[1] === 0 && c[2] === 0 && getComputedStyle(bgEl).backgroundColor.includes("0)"))) {
          bg = c;
          break;
        }
        bgEl = bgEl.parentElement;
      }
      if (!fg || !bg) continue;
      const l1 = lum(fg);
      const l2 = lum(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      if (ratio < 4.5) {
        contrastHits.push({
          text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60),
          color: st.color,
          bg: bgEl ? getComputedStyle(bgEl).backgroundColor : "",
          ratio: Math.round(ratio * 100) / 100,
        });
      }
      if (contrastHits.length >= 12) break;
    }
    return {
      skip: !!document.querySelector("a.neo-pulse-skip-link"),
      openMenu: !!document.querySelector('button[aria-label="Open menu"]'),
      unnamed,
      headings: [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].slice(0, 8).map((el) => el.tagName + " " + el.textContent.replace(/\s+/g, " ").trim().slice(0, 50)),
      contrastHits,
    };
  });
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
