import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 10203;
const FIRST = "c28b26d";
const STYLE =
  "font-family:'Lato',sans-serif;font-size:1rem;line-height:1.5;letter-spacing:0;word-spacing:normal;font-weight:400;-webkit-text-stroke:0;text-shadow:none";
const WIDGET_CSS = `selector, selector p, selector a, selector .elementor-widget-container {
  font-family: "Lato", sans-serif !important;
  font-size: 1rem !important;
  line-height: 1.5 !important;
  letter-spacing: 0 !important;
  word-spacing: normal !important;
  font-weight: 400 !important;
  -webkit-text-stroke: 0 !important;
  text-shadow: none !important;
}`;

const session = await openEmcp("neo-pulse-edmonton-seo-first-inline");
const got = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: POST_ID, element_id: FIRST },
  2,
);
const settings = got.data?.settings || got.data || {};
const editor = typeof settings.editor === "string" ? settings.editor : "";
if (!editor) throw new Error("first widget has no editor html");

const next = editor.includes(STYLE)
  ? editor
  : editor.split("<p>").join(`<p style="${STYLE}">`).split("<p ").join(`<p style="${STYLE}" `);

const updated = await callTool(
  session,
  "emcp-tools-update-element",
  {
    post_id: POST_ID,
    element_id: FIRST,
    settings: {
      editor: next,
      typography_typography: "custom",
      typography_font_family: "Lato",
      typography_font_size: { size: 1, unit: "rem" },
      typography_font_weight: "400",
      typography_line_height: { size: 1.5, unit: "em" },
      typography_letter_spacing: { size: 0, unit: "px" },
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
const afterSettings = after.data?.settings || after.data || {};
process.stdout.write(
  `${JSON.stringify(
    {
      update: updated.data,
      hasInline: String(afterSettings.editor || "").includes(STYLE),
      family: afterSettings.typography_font_family || null,
      size: afterSettings.typography_font_size || null,
    },
    null,
    2,
  )}\n`,
);
