import puppeteer from "puppeteer";
import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 10203;
const session = await openEmcp("neo-f51-img-size");
const imageIds = ["61debcc", "3a00fb0", "eb020ed", "7c91a12"];

for (const id of imageIds) {
  const r = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: id }, 1);
  const s = r.data?.settings || {};
  console.log(id, {
    width: s.width,
    _element_width: s._element_width,
    _element_custom_width: s._element_custom_width,
    image_size: s.image_size,
    align: s.align,
    image: s.image?.url?.slice(-40),
  });
}

const browser = await puppeteer.launch({ headless: true, defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
await page.goto("https://neodigital.ca/edmonton-seo/?nonitro=1&v=" + Date.now(), { waitUntil: "networkidle2", timeout: 90000 });

const sizes = await page.evaluate(() => {
  const rows = ["b79ecfb", "d65ad74", "4c1e062"];
  return rows.map((rowId) => {
    const row = document.querySelector(`.elementor-element-${rowId}`);
    if (!row) return null;
    const img = row.querySelector(".elementor-widget-image img");
    const textCol = row.querySelector(".e-con");
    return {
      rowId,
      rowW: row.getBoundingClientRect().width,
      rowH: row.getBoundingClientRect().height,
      imgW: img?.getBoundingClientRect().width,
      imgH: img?.getBoundingClientRect().height,
      textColW: textCol?.getBoundingClientRect().width,
      imgNatural: img ? { w: img.naturalWidth, h: img.naturalHeight } : null,
    };
  });
});
console.log("RENDERED:", JSON.stringify(sizes, null, 2));
await browser.close();
