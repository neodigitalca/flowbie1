import { callTool, openEmcp } from "./emcp-http.mjs";

const KIT_ID = 5564;
const WHITE = "#FFFFFF";
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
  color: #fff !important;
  letter-spacing: normal !important;
  word-spacing: normal !important;
  -webkit-text-stroke: 0 !important;
  font-feature-settings: normal !important;
  font-variant-ligatures: none !important;
}`;

const session = await openEmcp("neo-pulse-lato-restore");
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
      h1_color: WHITE,
      h2_typography_typography: "custom",
      h2_typography_font_family: "Lato",
      h2_color: WHITE,
      h3_typography_typography: "custom",
      h3_typography_font_family: "Lato",
      h3_color: WHITE,
      h4_typography_typography: "custom",
      h4_typography_font_family: "Lato",
      h4_color: WHITE,
      h5_typography_typography: "custom",
      h5_typography_font_family: "Lato",
      h5_color: WHITE,
      h6_typography_typography: "custom",
      h6_typography_font_family: "Lato",
      h6_color: WHITE,
      custom_css: P_CSS,
    },
  },
  2,
);

const after = await callTool(session, "emcp-tools-get-global-settings", {}, 3);
const a = after.data?.settings || {};

process.stdout.write(
  `${JSON.stringify(
    {
      updated: updated.data,
      h1: { family: a.h1_typography_font_family, color: a.h1_color },
      h2: { family: a.h2_typography_font_family, color: a.h2_color },
      h3: { family: a.h3_typography_font_family, color: a.h3_color },
      cssWhite: String(a.custom_css || "").includes("color: #fff"),
    },
    null,
    2,
  )}\n`,
);
