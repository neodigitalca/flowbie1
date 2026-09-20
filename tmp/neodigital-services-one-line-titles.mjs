import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 55;
const TITLES = {
  fe0b8b7: "WordPress Development",
  a4891eb: "Shopify Development",
  "3f36645": "Webflow Development",
  d8a4ec2: "Elementor Experts",
  f617485: "AISEO",
  e7dc475: "Edmonton SEO",
  e53f689: "Local SEO",
  a4c0ff0: "Google Ads",
};

const session = await openEmcp("neo-pulse-services-one-line-titles");
let id = 2;
const updated = [];
for (const [element_id, title_text] of Object.entries(TITLES)) {
  const res = await callTool(
    session,
    "emcp-tools-update-element",
    { post_id: POST_ID, element_id, settings: { title_text } },
    id++,
  );
  updated.push({ element_id, title_text, ok: res.data?.success === true });
}

const found = await callTool(
  session,
  "emcp-tools-find-element",
  { post_id: POST_ID, widget_type: "ygency-info-box" },
  id++,
);
const titles = (found.data?.matches || []).map((m) => ({
  id: m.element_id,
  title: m.settings_preview?.title_text,
}));

process.stdout.write(
  `${JSON.stringify(
    {
      updated,
      titles,
      stillHasBreak: titles.some((t) => String(t.title).includes("<br")),
    },
    null,
    2,
  )}\n`,
);
