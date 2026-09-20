import puppeteer from "puppeteer";
import { callTool, openEmcp } from "./emcp-http.mjs";

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 });
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1&v=" + Date.now(), {
  waitUntil: "networkidle2",
  timeout: 90000,
});

const report = await page.evaluate(() => {
  const ids = ["afa170d", "9806fc2", "4101a06", "e8af43f", "bb9c5ef", "355952b", "8912c61", "15117cd"];
  return ids.map((id) => {
    const el = document.querySelector(`.elementor-element-${id}`);
    if (!el) return { id, missing: true };
    const r = el.getBoundingClientRect();
    const s = window.getComputedStyle(el);
    return {
      id,
      x: Math.round(r.x),
      y: Math.round(r.y),
      w: Math.round(r.width),
      h: Math.round(r.height),
      overflow: s.overflow,
      flexDirection: s.flexDirection,
      fontSize: s.fontSize,
      text: el.innerText?.slice(0, 30),
    };
  });
});

const logoImg = await page.evaluate(() => {
  const img = document.querySelector(".elementor-element-355952b img");
  if (!img) return null;
  const r = img.getBoundingClientRect();
  return {
    w: r.width,
    h: r.height,
    natural: { w: img.naturalWidth, h: img.naturalHeight },
    src: img.src.slice(-40),
  };
});

console.log("MOBILE LAYOUT:", JSON.stringify(report, null, 2));
console.log("LOGO:", logoImg);

await page.screenshot({ path: "tmp/hero-mobile-390.png", fullPage: false });
await browser.close();

const session = await openEmcp("neo-hero-mobile-settings");
for (const id of ["4101a06", "e8af43f", "bb9c5ef", "355952b", "9806fc2", "afa170d"]) {
  const r = await callTool(session, "emcp-tools-get-element-settings", { post_id: 10203, element_id: id }, 1);
  const s = r.data?.settings || {};
  console.log(
    id,
    JSON.stringify({
      flex_direction: s.flex_direction,
      flex_direction_mobile: s.flex_direction_mobile,
      width_mobile: s.width_mobile,
      padding_mobile: s.padding_mobile,
      margin_mobile: s.margin_mobile,
      custom_css: s.custom_css?.slice(0, 150),
    }),
  );
}
