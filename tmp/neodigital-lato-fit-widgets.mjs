import { callTool, openEmcp } from "./emcp-http.mjs";

const KIT_ID = 5564;
const P_CSS = `.elementor-widget p {
  font-family: "Lato", sans-serif !important;
  font-size: max(1rem, 1em);
  letter-spacing: normal !important;
  word-spacing: normal !important;
  -webkit-text-stroke: 0 !important;
  font-feature-settings: normal !important;
  font-variant-ligatures: none !important;
}
.elementor-widget .elementor-heading-title {
  font-family: "Lato", sans-serif !important;
  letter-spacing: normal !important;
  word-spacing: normal !important;
  -webkit-text-stroke: 0 !important;
  font-feature-settings: normal !important;
  font-variant-ligatures: none !important;
}`;

const session = await openEmcp("neo-pulse-lato-fit");
const updated = await callTool(
  session,
  "emcp-tools-update-page-settings",
  {
    post_id: KIT_ID,
    settings: {
      body_typography_typography: "custom",
      body_typography_font_family: "Lato",
      body_typography_font_size: { size: 1, unit: "rem" },
      body_typography_font_weight: "400",
      h1_typography_typography: "custom",
      h1_typography_font_family: "Lato",
      h2_typography_typography: "custom",
      h2_typography_font_family: "Lato",
      h3_typography_typography: "custom",
      h3_typography_font_family: "Lato",
      h4_typography_typography: "custom",
      h4_typography_font_family: "Lato",
      h5_typography_typography: "custom",
      h5_typography_font_family: "Lato",
      h6_typography_typography: "custom",
      h6_typography_font_family: "Lato",
      custom_css: P_CSS,
    },
  },
  2,
);

const after = await callTool(session, "emcp-tools-get-global-settings", {}, 3);
const s = after.data?.settings || {};

process.stdout.write(
  `${JSON.stringify(
    {
      updated: updated.data,
      bodyFamily: s.body_typography_font_family,
      h1: s.h1_typography_font_family,
      h2: s.h2_typography_font_family,
      h3: s.h3_typography_font_family,
      cssHasHeading: String(s.custom_css || "").includes("heading-title"),
      cssHasWrapper: String(s.custom_css || "").includes("text-editor"),
    },
    null,
    2,
  )}\n`,
);
