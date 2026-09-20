import { callTool, openEmcp } from "./emcp-http.mjs";

const KIT_ID = 5564;
const P_CSS = `.elementor-widget p,
.elementor-widget .elementor-text-editor,
.elementor-widget .elementor-widget-container > p {
  font-family: "Lato", sans-serif !important;
  font-size: max(1rem, 1em);
  letter-spacing: 0;
  word-spacing: 0;
  -webkit-text-stroke: 0;
}`;

const TEXT_TOKEN = {
  _id: "text",
  title: "Text",
  typography_font_family: "Lato",
  typography_font_weight: "400",
  typography_font_size: { size: 1, unit: "rem" },
  typography_font_size_tablet: { size: 1, unit: "rem" },
  typography_font_size_mobile: { size: 1, unit: "rem" },
  typography_line_height: { size: 1.5, unit: "em" },
};

const VERIFY_URLS = [
  { name: "home", url: "https://neodigital.ca/?nonitro=1" },
  { name: "edmonton-seo", url: "https://neodigital.ca/edmonton-seo/?nonitro=1" },
  { name: "local-seo", url: "https://neodigital.ca/local-seo/?nonitro=1" },
  { name: "about", url: "https://neodigital.ca/about/?nonitro=1" },
];

const session = await openEmcp("neo-pulse-lato-p-floor");
let id = 2;

const before = await callTool(session, "emcp-tools-get-global-settings", {}, id++);
const typography = Array.isArray(before.data?.typography) ? before.data.typography : [];
const nextTypography = typography.map((token) =>
  token._id === "text" ? { ...token, ...TEXT_TOKEN } : token,
);

const updatedTokens = await callTool(
  session,
  "emcp-tools-update-global-typography",
  { typography: nextTypography },
  id++,
);

const updatedKit = await callTool(
  session,
  "emcp-tools-update-page-settings",
  {
    post_id: KIT_ID,
    settings: {
      body_typography_typography: "custom",
      body_typography_font_family: "Lato",
      body_typography_font_size: { size: 1, unit: "rem" },
      body_typography_font_weight: "400",
      custom_css: P_CSS,
    },
  },
  id++,
);

const after = await callTool(session, "emcp-tools-get-global-settings", {}, id++);
const afterSettings = after.data?.settings || {};
const afterText = (after.data?.typography || []).find((token) => token._id === "text");

const pages = [];
for (const row of VERIFY_URLS) {
  const html = await callTool(
    session,
    "emcp-tools-get-page-html",
    { url: row.url, max_bytes: 120000 },
    id++,
  );
  const blob = JSON.stringify(html.data);
  pages.push({
    name: row.name,
    hasLato: blob.includes("Lato"),
    hasFloor: blob.includes("max(1rem") || blob.includes("max(1rem, 1em)"),
    hasPCss: blob.includes(".elementor-widget p"),
  });
}

const kitCss = await callTool(
  session,
  "emcp-tools-get-page-html",
  { url: "https://neodigital.ca/wp-content/uploads/elementor/css/post-5564.css", max_bytes: 80000 },
  id++,
);
const kitBlob = JSON.stringify(kitCss.data);

process.stdout.write(
  `${JSON.stringify(
    {
      kitId: KIT_ID,
      tokenUpdate: updatedTokens.data?.ok ?? updatedTokens.data,
      kitUpdate: updatedKit.data?.ok ?? updatedKit.data,
      textAfter: afterText,
      bodyFamily: afterSettings.body_typography_font_family,
      bodySize: afterSettings.body_typography_font_size,
      customCssSet: afterSettings.custom_css === P_CSS,
      kitCssHasLato: kitBlob.includes("Lato"),
      kitCssHasFloor: kitBlob.includes("max(1rem"),
      pages,
    },
    null,
    2,
  )}\n`,
);
