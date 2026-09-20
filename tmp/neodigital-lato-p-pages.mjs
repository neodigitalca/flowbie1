import { callTool, openEmcp } from "./emcp-http.mjs";

const URLS = [
  { name: "home", url: "https://neodigital.ca/?nonitro=1" },
  { name: "edmonton-seo", url: "https://neodigital.ca/edmonton-seo/?nonitro=1" },
  { name: "local-seo", url: "https://neodigital.ca/local-seo/?nonitro=1" },
  { name: "about", url: "https://neodigital.ca/about/?nonitro=1" },
  { name: "kit-css", url: "https://neodigital.ca/wp-content/uploads/elementor/css/post-5564.css" },
];

const session = await openEmcp("neo-pulse-lato-pages");
let id = 2;
const pages = [];

for (const row of URLS) {
  const html = await callTool(
    session,
    "emcp-tools-get-page-html",
    { url: row.url, max_bytes: 240000 },
    id++,
  );
  const blob = JSON.stringify(html.data);
  pages.push({
    name: row.name,
    hasLato: blob.includes("Lato"),
    hasFontFace: /font-family:\\?\"?Lato/.test(blob) || blob.includes("font-family:Lato") || blob.includes("font-family: Lato"),
    hasFloor: blob.includes("max(1rem"),
    hasPCss: blob.includes(".elementor-widget p"),
    hasBody1rem: blob.includes("font-size:1rem") || blob.includes("font-size: 1rem"),
  });
}

process.stdout.write(`${JSON.stringify({ pages }, null, 2)}\n`);
