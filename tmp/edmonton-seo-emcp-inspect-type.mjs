import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 10203;
const session = await openEmcp("neo-pulse-edmonton-seo-type");
let id = 2;

const skill = await callTool(session, "emcp-tools-get-skill", { slug: "emcp-skills/recipes" }, id++);
const skillText = typeof skill.data?.text === "string" ? skill.data.text : JSON.stringify(skill.data);
const cssHits = [];
for (const needle of ["custom_css", "custom CSS", "typography", "font-family", "read-modify"]) {
  const at = skillText.toLowerCase().indexOf(needle.toLowerCase());
  if (at >= 0) cssHits.push({ needle, snippet: skillText.slice(Math.max(0, at - 80), at + 280) });
}

const globals = await callTool(session, "emcp-tools-get-global-settings", {}, id++);
const headings = await callTool(
  session,
  "emcp-tools-find-element",
  { post_id: POST_ID, widget_type: "heading" },
  id++,
);
const texts = await callTool(
  session,
  "emcp-tools-find-element",
  { post_id: POST_ID, widget_type: "text-editor" },
  id++,
);

const sampleIds = ["2bbef65", "c28b26d"];
const samples = [];
for (const element_id of sampleIds) {
  const got = await callTool(
    session,
    "emcp-tools-get-element-settings",
    { post_id: POST_ID, element_id },
    id++,
  );
  const settings = got.data?.settings || got.data || {};
  const keys = Object.keys(settings).filter((key) =>
    /font|typo|title|editor|header_size|letter|css/i.test(key),
  );
  const picked = {};
  for (const key of keys) picked[key] = settings[key];
  samples.push({ element_id, widgetType: got.data?.widget_type || settings.widgetType, picked });
}

process.stdout.write(
  `${JSON.stringify(
    {
      skillCssHits: cssHits,
      globalKeys: globals.data && typeof globals.data === "object" ? Object.keys(globals.data) : [],
      typography: globals.data?.typography || globals.data?.system_typography || null,
      headingMatches: headings.data,
      textMatches: texts.data,
      samples,
    },
    null,
    2,
  )}\n`,
);
