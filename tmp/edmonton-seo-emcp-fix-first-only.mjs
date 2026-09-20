import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 10203;
const FIRST = "c28b26d";
const WIDGET_CSS = `selector, selector p, selector a {
  font-family: "Lato", sans-serif !important;
  font-size: 1rem !important;
  line-height: 1.5 !important;
  letter-spacing: 0 !important;
  word-spacing: 0 !important;
  font-weight: 400 !important;
  -webkit-text-stroke: 0 !important;
  text-shadow: none !important;
}`;

const session = await openEmcp("neo-pulse-edmonton-seo-first-only");
const before = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: POST_ID, element_id: FIRST },
  2,
);
const updated = await callTool(
  session,
  "emcp-tools-update-element",
  {
    post_id: POST_ID,
    element_id: FIRST,
    settings: {
      typography_typography: "custom",
      typography_font_family: "Lato",
      typography_font_size: { size: 1, unit: "rem" },
      typography_font_weight: "400",
      typography_line_height: { size: 1.5, unit: "em" },
      typography_letter_spacing: { size: 0, unit: "px" },
      typography_word_spacing: { size: 0, unit: "px" },
      __globals__: { typography_typography: "" },
      custom_css: WIDGET_CSS,
    },
  },
  3,
);
const after = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: POST_ID, element_id: FIRST },
  4,
);
const html = await callTool(
  session,
  "emcp-tools-get-page-html",
  { url: "https://neodigital.ca/edmonton-seo/?nonitro=1", max_bytes: 220000 },
  5,
);
const beforeSettings = before.data?.settings || before.data || {};
const afterSettings = after.data?.settings || after.data || {};
const blob = JSON.stringify(html.data);
const at = blob.indexOf("elementor-element-c28b26d");
process.stdout.write(
  `${JSON.stringify(
    {
      beforeFamily: beforeSettings.typography_font_family || null,
      beforeCss: beforeSettings.custom_css || null,
      beforeGlobals: beforeSettings.__globals__ || null,
      update: updated.data,
      afterFamily: afterSettings.typography_font_family || null,
      afterSize: afterSettings.typography_font_size || null,
      afterCss: afterSettings.custom_css || null,
      widgetHtml: at >= 0 ? blob.slice(at, at + 700) : "",
      htmlHasLatoCss: blob.includes("Lato"),
    },
    null,
    2,
  )}\n`,
);
