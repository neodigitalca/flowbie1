import { callTool, openEmcp } from "./emcp-http.mjs";

const KIT_ID = 5564;
const WHITE = "#FFFFFF";
const P_CSS = `.elementor-widget p {
  font-family: "Lato", sans-serif !important;
  font-size: max(1rem, 1em);
}
.elementor-widget .elementor-heading-title {
  font-family: "Lato", sans-serif !important;
  color: #fff !important;
}
.ygency-info-box .box-title,
.ygency-info-box .title-text {
  font-family: "Lato", sans-serif !important;
  color: #fff !important;
  font-size: 1.25rem;
  line-height: 1.25;
  font-weight: 600;
}
.ygency-info-box .description {
  font-family: "Lato", sans-serif !important;
  font-size: 1rem;
  line-height: 1.5;
  color: #c8c8c8 !important;
}`;

const session = await openEmcp("neo-pulse-lato-infobox");
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

process.stdout.write(`${JSON.stringify({ updated: updated.data, cssLen: P_CSS.length }, null, 2)}\n`);
