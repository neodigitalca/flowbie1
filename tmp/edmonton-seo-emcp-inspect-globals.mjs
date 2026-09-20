import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 10203;
const session = await openEmcp("neo-pulse-edmonton-seo-globals");
let id = 2;

const ids = ["2bbef65", "c28b26d", "afa170d", "4f337d2", "79b72fd"];
const rows = [];
for (const element_id of ids) {
  const got = await callTool(
    session,
    "emcp-tools-get-element-settings",
    { post_id: POST_ID, element_id },
    id++,
  );
  const settings = got.data?.settings || got.data || {};
  rows.push({
    element_id,
    globals: settings.__globals__ || null,
    custom_css: settings.custom_css || null,
    header_size: settings.header_size || null,
    typography_typography: settings.typography_typography || null,
    typography_font_family: settings.typography_font_family || null,
    typography_font_size: settings.typography_font_size || null,
    classes: settings._css_classes || settings.css_classes || null,
  });
}

const cssKey = await callTool(
  session,
  "emcp-tools-find-element",
  { post_id: POST_ID, setting_key: "custom_css" },
  id++,
);

const skill = await callTool(session, "emcp-tools-get-skill", { slug: "emcp-skills" }, id++);
const skillText = typeof skill.data?.text === "string" ? skill.data.text : JSON.stringify(skill.data);
const at = skillText.toLowerCase().indexOf("custom-css");
const at2 = skillText.toLowerCase().indexOf("custom css");

process.stdout.write(
  `${JSON.stringify(
    {
      rows,
      cssKey: cssKey.data,
      skillCustomCss: at >= 0 ? skillText.slice(at, at + 900) : at2 >= 0 ? skillText.slice(at2, at2 + 900) : skillText.slice(0, 400),
    },
    null,
    2,
  )}\n`,
);
