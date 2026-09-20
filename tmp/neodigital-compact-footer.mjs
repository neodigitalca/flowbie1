import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 163;
const session = await openEmcp("neo-pulse-compact-footer");
let id = 2;

// 1. Add Column 1 (About Column) into 56cfa90 at position 0
const addCol = await callTool(
  session,
  "emcp-tools-add-container",
  {
    post_id: POST_ID,
    parent_id: "56cfa90",
    position: 0,
    settings: {
      content_width: "full",
      flex_direction: "column",
      _element_custom_width: { unit: "%", size: 40, sizes: [] },
      _element_custom_width_tablet: { unit: "%", size: 100, sizes: [] },
      _element_custom_width_mobile: { unit: "%", size: 100, sizes: [] },
      padding: { unit: "px", top: "0", right: "40", bottom: "0", left: "0", isLinked: false },
      _title: "About Column",
    },
  },
  id++,
);

const aboutColId = addCol.data?.element_id || addCol.data?.id;
process.stdout.write(`Added aboutCol: ${aboutColId}\n`);

// 2. Move Logo (87a2060) into aboutCol at pos 0
await callTool(
  session,
  "emcp-tools-move-element",
  {
    post_id: POST_ID,
    element_id: "87a2060",
    target_parent_id: aboutColId,
    position: 0,
  },
  id++,
);

// Update Logo size so it fits nicely
await callTool(
  session,
  "emcp-tools-update-element",
  {
    post_id: POST_ID,
    element_id: "87a2060",
    settings: {
      space: { unit: "px", size: 240, sizes: [] },
      _margin: { unit: "px", top: "0", right: "0", bottom: "20", left: "0", isLinked: false },
    },
  },
  id++,
);

// 3. Add text-editor widget for About text into aboutCol at pos 1
const aboutCopy =
  '<p style="color: #c8c8c8; font-size: 1rem; line-height: 1.6; margin-bottom: 20px;">Neo Digital is an Edmonton digital marketing agency specializing in high-performance <a href="https://neodigital.ca/website-design/" style="color: #fff; text-decoration: underline;">Website Design</a>, specialized <a href="https://neodigital.ca/elementor-help/" style="color: #fff; text-decoration: underline;">Elementor Experts</a> support, data-driven <a href="https://neodigital.ca/edmonton-seo/" style="color: #fff; text-decoration: underline;">Edmonton SEO</a> &amp; <a href="https://neodigital.ca/local-seo/" style="color: #fff; text-decoration: underline;">Local SEO</a>, next-gen <a href="https://neodigital.ca/aiseo/" style="color: #fff; text-decoration: underline;">AISEO</a>, and conversion-focused <a href="https://neodigital.ca/google-ads/" style="color: #fff; text-decoration: underline;">Google Ads</a>.</p>';

await callTool(
  session,
  "emcp-tools-add-free-widget",
  {
    post_id: POST_ID,
    parent_id: aboutColId,
    position: 1,
    widget_type: "text-editor",
    settings: {
      editor: aboutCopy,
      _margin: { unit: "px", top: "0", right: "0", bottom: "15", left: "0", isLinked: false },
    },
  },
  id++,
);

// 4. Move Social Links (2d805f8) into aboutCol at pos 2
await callTool(
  session,
  "emcp-tools-move-element",
  {
    post_id: POST_ID,
    element_id: "2d805f8",
    target_parent_id: aboutColId,
    position: 2,
  },
  id++,
);

// 5. Update Quick Links column (98d96a2)
await callTool(
  session,
  "emcp-tools-update-element",
  {
    post_id: POST_ID,
    element_id: "98d96a2",
    settings: {
      content_width: "full",
      _element_custom_width: { unit: "%", size: 28, sizes: [] },
      _element_custom_width_tablet: { unit: "%", size: 48, sizes: [] },
      _element_custom_width_mobile: { unit: "%", size: 100, sizes: [] },
      padding: { unit: "px", top: "0", right: "20", bottom: "0", left: "0", isLinked: false },
      border_border: "none",
      border_width: { unit: "px", top: "0", right: "0", bottom: "0", left: "0", isLinked: true },
    },
  },
  id++,
);

// 6. Update CTA column (24fc949)
await callTool(
  session,
  "emcp-tools-update-element",
  {
    post_id: POST_ID,
    element_id: "24fc949",
    settings: {
      content_width: "full",
      _element_custom_width: { unit: "%", size: 32, sizes: [] },
      _element_custom_width_tablet: { unit: "%", size: 48, sizes: [] },
      _element_custom_width_mobile: { unit: "%", size: 100, sizes: [] },
      padding: { unit: "px", top: "0", right: "0", bottom: "0", left: "0", isLinked: false },
    },
  },
  id++,
);

// Update 0efac59 heading (single line, no <br>)
await callTool(
  session,
  "emcp-tools-update-element",
  {
    post_id: POST_ID,
    element_id: "0efac59",
    settings: {
      title: "Let’s Work Together",
      typography_font_size: { unit: "px", size: 40, sizes: [] },
      typography_font_size_tablet: { unit: "px", size: 36, sizes: [] },
      typography_font_size_mobile: { unit: "px", size: 30, sizes: [] },
      _margin: { unit: "px", top: "0", right: "0", bottom: "25", left: "0", isLinked: false },
    },
  },
  id++,
);

// Move Health Canada badge (05c7626) into CTA column 24fc949 at pos 2
await callTool(
  session,
  "emcp-tools-move-element",
  {
    post_id: POST_ID,
    element_id: "05c7626",
    target_parent_id: "24fc949",
    position: 2,
  },
  id++,
);

// Update badge margin
await callTool(
  session,
  "emcp-tools-update-element",
  {
    post_id: POST_ID,
    element_id: "05c7626",
    settings: {
      _margin: { unit: "px", top: "25", right: "0", bottom: "0", left: "0", isLinked: false },
    },
  },
  id++,
);

// 7. Update Row 1 (56cfa90) settings to be compact and flex-wrap
await callTool(
  session,
  "emcp-tools-update-element",
  {
    post_id: POST_ID,
    element_id: "56cfa90",
    settings: {
      flex_direction: "row",
      flex_wrap: "wrap",
      flex_justify_content: "space-between",
      flex_align_items: "flex-start",
      padding: { unit: "px", top: "50", right: "0", bottom: "40", left: "0", isLinked: false },
      _title: "Row 1 - Main Content",
    },
  },
  id++,
);

// 8. Update Row 2 (780eb96) settings to be compact bottom bar
await callTool(
  session,
  "emcp-tools-update-element",
  {
    post_id: POST_ID,
    element_id: "780eb96",
    settings: {
      flex_direction: "row",
      flex_justify_content: "space-between",
      flex_align_items: "center",
      border_border: "solid",
      border_width: { unit: "px", top: "1", right: "0", bottom: "0", left: "0", isLinked: false },
      border_color: "rgba(255, 255, 255, 0.10)",
      padding: { unit: "px", top: "20", right: "0", bottom: "20", left: "0", isLinked: false },
      margin: { unit: "px", top: "0", right: "0", bottom: "0", left: "0", isLinked: true },
      _title: "Row 2 - Bottom Bar",
    },
  },
  id++,
);

// Remove empty container 6d52f47 in Row 2
await callTool(
  session,
  "emcp-tools-remove-element",
  { post_id: POST_ID, element_id: "6d52f47" },
  id++,
);

// 9. Remove old Row 1 (47b9932) since its logo and social were moved
await callTool(
  session,
  "emcp-tools-remove-element",
  { post_id: POST_ID, element_id: "47b9932" },
  id++,
);

// 10. Check final structure
const finalStruct = await callTool(
  session,
  "emcp-tools-get-page-structure",
  { post_id: POST_ID, max_depth: 6 },
  id++,
);

process.stdout.write(
  `${JSON.stringify({ final: finalStruct.data?.structure }, null, 2)}\n`,
);
