import { callTool, openEmcp } from "./emcp-http.mjs";

const KIT_ID = 5564;
const WHITE = "#FFFFFF";
const ACCENT = "#84BD00";

const GLOBAL_CSS = `/* Universal body & paragraph typography */
body,
.elementor-widget p,
.elementor-widget-text-editor p,
.ygency-feature-box .box-desc,
.ygency-feature-box p,
.ygency-work-process .desc,
.ygency-work-process p,
.ygency-testimonials .position,
.ygency-testimonials p,
.ygency-info-box .description {
  font-family: "Lato", sans-serif !important;
  font-size: 1.5rem;
  line-height: 1.6;
  color: #c8c8c8 !important;
}

/* Headings in widgets */
.elementor-widget-heading .elementor-heading-title,
.ygency-feature-box .box-title,
.ygency-feature-box .box-title a {
  font-family: "Lato", sans-serif !important;
  color: #fff !important;
}

/* Feature box index numbers (01, 02...) on dark background */
.ygency-feature-box .box-index {
  color: rgba(255, 255, 255, 0.4) !important;
  font-family: "Lato", sans-serif !important;
}

/* Home info-boxes */
.ygency-info-box .box-title,
.ygency-info-box .title-text {
  font-family: "Lato", sans-serif !important;
  color: #fff !important;
  font-size: 1.25rem;
  line-height: 1.25;
  font-weight: 600;
  white-space: nowrap;
}
.ygency-info-box .title-text br {
  display: none;
}
.ygency-info-box .description {
  font-family: "Lato", sans-serif !important;
  font-size: 1.5rem;
  line-height: 1.5;
  color: #c8c8c8 !important;
}

/* Home Counter Numbers - solid green, no white stroke */
.qodef-qi-counter .qodef-m-digit,
.qodef-qi-counter .qodef-m-digit-label,
.qodef-qi-counter .qodef-m-digit-wrapper {
  color: #84BD00 !important;
  -webkit-text-fill-color: #84BD00 !important;
  -webkit-text-stroke: 0px !important;
}

/* CTA "Let's Chat" green circle button - solid green instead of see-through */
.ygency-button.icon-top,
.ygency-button-wrapper a.ygency-button.icon-top {
  background-color: #84BD00 !important;
  border-color: #84BD00 !important;
  color: #02050A !important;
}
.ygency-button.icon-top .button-text,
.ygency-button.icon-top .button-icon i,
.ygency-button-wrapper a.ygency-button.icon-top .button-text,
.ygency-button-wrapper a.ygency-button.icon-top .button-icon i {
  color: #02050A !important;
}
.ygency-button.icon-top:hover,
.ygency-button-wrapper a.ygency-button.icon-top:hover {
  background-color: #99d600 !important;
  border-color: #99d600 !important;
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .ygency-info-box .box-title,
  .ygency-info-box .title-text { font-size: 1.125rem; }
  body,
  .elementor-widget p,
  .ygency-feature-box .box-desc,
  .ygency-info-box .description {
    font-size: 1.375rem;
  }
}
@media (max-width: 767px) {
  .ygency-info-box .box-title,
  .ygency-info-box .title-text { font-size: 1rem; }
  body,
  .elementor-widget p,
  .ygency-feature-box .box-desc,
  .ygency-info-box .description {
    font-size: 1.25rem;
  }
}`;

const session = await openEmcp("neo-pulse-kit-full-typography");
const updated = await callTool(
  session,
  "emcp-tools-update-page-settings",
  {
    post_id: KIT_ID,
    settings: {
      body_typography_typography: "custom",
      body_typography_font_family: "Lato",
      body_typography_font_size: { size: 1.5, unit: "rem" },
      body_typography_font_weight: "400",
      body_color: "#C8C8C8",
      h1_typography_font_family: "Lato",
      h1_color: WHITE,
      h2_typography_font_family: "Lato",
      h2_color: WHITE,
      h3_typography_font_family: "Lato",
      h3_color: WHITE,
      h4_typography_font_family: "Lato",
      h4_color: WHITE,
      h5_typography_font_family: "Lato",
      h5_color: WHITE,
      h6_typography_font_family: "Lato",
      h6_color: WHITE,
      custom_css: GLOBAL_CSS,
    },
  },
  2,
);

process.stdout.write(`${JSON.stringify({ updated: updated.data }, null, 2)}\n`);
