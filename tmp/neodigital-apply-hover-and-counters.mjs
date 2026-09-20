import { callTool, openEmcp } from "./emcp-http.mjs";

const KIT_ID = 5564;
const POST_7605 = 7605;
const session = await openEmcp("neo-pulse-fix-hover-and-counters");
let id = 2;

// 1. Update Kit 5564 Custom CSS
const kitSettings = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: KIT_ID, element_id: "" },
  id++,
);

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

/* CTA "Let's Chat" button - solid green circle default */
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

/* CTA "Let's Chat" on hover - turns black with white font on black */
.ygency-button.icon-top:hover,
.ygency-button-wrapper a.ygency-button.icon-top:hover {
  background-color: #02050A !important;
  border-color: #84BD00 !important;
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

const updateKit = await callTool(
  session,
  "emcp-tools-update-page-settings",
  {
    post_id: KIT_ID,
    settings: {
      custom_css: GLOBAL_CSS,
    },
  },
  id++,
);
console.log({ updateKit: updateKit.data?.success });

// 2. Update Elementor settings on template 7605 button 6eb27dc1
const updateBtn7605 = await callTool(
  session,
  "emcp-tools-update-element",
  {
    post_id: POST_7605,
    element_id: "6eb27dc1",
    settings: {
      button_bg: "#84BD00",
      border_color: "#84BD00",
      button_color: "#02050A",
      button_hover_bg: "#02050A",
      button_hover_color: "#FFFFFF",
      hover_border_color: "#84BD00",
    },
  },
  id++,
);
console.log({ updateBtn7605: updateBtn7605.data?.success });

// 3. Update home page (post 55) ygency counters: 53edf1d, 04e1b1a, 0ed5015 to have counter_color #FFFFFF
const counters = ["53edf1d", "04e1b1a", "0ed5015"];
for (const c of counters) {
  const existing = await callTool(
    session,
    "emcp-tools-get-element-settings",
    { post_id: 55, element_id: c },
    id++,
  );
  const globals = { ...(existing.data?.settings?.__globals__ || {}) };
  delete globals.counter_color;

  await callTool(
    session,
    "emcp-tools-update-element",
    {
      post_id: 55,
      element_id: c,
      settings: {
        counter_color: "#FFFFFF",
        counter_text_stroke_text_stroke_type: "no",
        __globals__: globals,
      },
    },
    id++,
  );
}
console.log("Home counters updated to white!");
