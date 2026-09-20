import { callTool, openEmcp } from "./emcp-http.mjs";
import { runNeodigitalPhp } from "../scripts/edmonton-internal-links/sftp-oneshot.mjs";

const POST_ID = 5564; // Elementor Kit ID

async function run() {
  const session = await openEmcp("neo-pulse-update-lato-typography");
  let seq = 1;

  console.log("=== STEP 1: Update Global Typography tokens to Lato ===");
  const typoRes = await callTool(session, "emcp-tools-update-global-typography", {
    typography: [
      {
        _id: "primary",
        title: "Primary",
        typography_font_family: "Lato",
        typography_font_weight: "700"
      },
      {
        _id: "secondary",
        title: "Secondary",
        typography_font_family: "Lato",
        typography_font_weight: "600"
      },
      {
        _id: "text",
        title: "Text",
        typography_font_family: "Lato",
        typography_font_weight: "400",
        typography_font_size: { size: 1.5, unit: "rem" },
        typography_line_height: { size: 1.6, unit: "em" }
      },
      {
        _id: "accent",
        title: "Accent",
        typography_font_family: "Lato",
        typography_font_weight: "500"
      }
    ]
  }, seq++);
  console.log("Global typography updated:", typoRes.data);

  console.log("=== STEP 2: Update Kit 5564 page settings with custom CSS and body typography ===");
  const customCss = `@import url('https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,300;0,400;0,700;1,400&display=swap');

/* Universal body & paragraph typography - Lato 1.5rem normal weight (400) */
body,
p,
.elementor p,
.elementor-widget p,
.elementor-widget-text-editor,
.elementor-widget-text-editor p,
.ygency-feature-box .box-desc,
.ygency-feature-box p,
.ygency-work-process .desc,
.ygency-work-process p,
.ygency-testimonials .position,
.ygency-testimonials p,
.ygency-info-box .description,
.list-desc {
  font-family: "Lato", sans-serif !important;
  font-size: 1.5rem !important;
  font-weight: 400 !important;
  line-height: 1.6 !important;
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
  font-size: 1.5rem !important;
  line-height: 1.6 !important;
  font-weight: 400 !important;
  color: #c8c8c8 !important;
}

/* White paragraph text on dark surfaces / cards */
.elementor-element-3553037 p,
.elementor-element-fb92c02 p,
.elementor-element-f3851d6 p,
.elementor-element-ba7052d p {
  color: #FFFFFF !important;
  font-family: "Lato", sans-serif !important;
  font-size: 1.5rem !important;
  font-weight: 400 !important;
  line-height: 1.6 !important;
}

/* Stat Counters - White default for high contrast on dark background */
.ygency-counter-box .counter-wrap,
.ygency-counter-box .elementor-counter-number,
.ygency-counter-box .counter-suffix,
.qodef-qi-counter .qodef-m-digit,
.qodef-qi-counter .qodef-m-digit-label,
.qodef-qi-counter .qodef-m-digit-wrapper {
  color: #FFFFFF !important;
  -webkit-text-fill-color: #FFFFFF !important;
  -webkit-text-stroke: 0px !important;
}

/* CTA "Let's Chat" green circle button - transparent but high contrast */
.ygency-button.icon-top,
.ygency-button-wrapper a.ygency-button.icon-top {
  background-color: #84BD00 !important;
  border: 2px solid #84BD00 !important;
  box-shadow: 0 0 25px rgba(132, 189, 0, 0.25) !important;
  color: #02050A !important;
}
.ygency-button.icon-top .button-text,
.ygency-button.icon-top .button-icon i,
.ygency-button-wrapper a.ygency-button.icon-top .button-text,
.ygency-button-wrapper a.ygency-button.icon-top .button-icon i {
  color: #02050A !important;
  font-weight: 700 !important;
}

/* CTA "Let's Chat" on hover - turns black with white font on black */
.ygency-button.icon-top:hover,
.ygency-button-wrapper a.ygency-button.icon-top:hover {
  background-color: #02050A !important;
  border-color: #84BD00 !important;
  box-shadow: 0 0 30px rgba(132, 189, 0, 0.35) !important;
}
.ygency-button.icon-top:hover::before,
.ygency-button.icon-top:hover::after,
.ygency-button-wrapper a.ygency-button.icon-top:hover::before,
.ygency-button-wrapper a.ygency-button.icon-top:hover::after {
  background-color: #02050A !important;
}
.ygency-button.icon-top:hover .button-text,
.ygency-button.icon-top:hover .button-icon,
.ygency-button.icon-top:hover .button-icon i,
.ygency-button.icon-top:hover i,
.ygency-button-wrapper a.ygency-button.icon-top:hover .button-text,
.ygency-button-wrapper a.ygency-button.icon-top:hover .button-icon,
.ygency-button-wrapper a.ygency-button.icon-top:hover .button-icon i,
.ygency-button-wrapper a.ygency-button.icon-top:hover i {
  color: #FFFFFF !important;
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .ygency-info-box .box-title,
  .ygency-info-box .title-text { font-size: 1.125rem; }
  body,
  p,
  .elementor p,
  .elementor-widget p,
  .ygency-feature-box .box-desc,
  .ygency-info-box .description {
    font-size: 1.375rem !important;
  }
}
@media (max-width: 767px) {
  .ygency-info-box .box-title,
  .ygency-info-box .title-text { font-size: 1rem; }
  body,
  p,
  .elementor p,
  .elementor-widget p,
  .ygency-feature-box .box-desc,
  .ygency-info-box .description {
    font-size: 1.25rem !important;
  }
}`;

  const kitUpdate = await callTool(session, "emcp-tools-update-page-settings", {
    post_id: POST_ID,
    settings: {
      custom_css: customCss,
      body_typography_typography: "custom",
      body_typography_font_family: "Lato",
      body_typography_font_weight: "400",
      body_typography_font_size: { size: 1.5, unit: "rem" },
      body_typography_line_height: { size: 1.6, unit: "em" }
    }
  }, seq++);
  console.log("Kit 5564 updated:", kitUpdate.data);

  console.log("=== STEP 3: Clear Elementor CSS cache on remote ===");
  const phpFlush = `
if ( class_exists( '\\Elementor\\Plugin' ) ) {
    \\Elementor\\Plugin::$instance->files_manager->clear_cache();
}
echo wp_json_encode(array('ok' => true, 'cache_cleared' => true));
`;
  const flushRes = await runNeodigitalPhp(phpFlush, "oneshot-flush-elementor-css");
  console.log("Elementor cache cleared:", flushRes);
}

run().catch(console.error);
