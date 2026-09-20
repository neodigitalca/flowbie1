import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-infobox");
const found = await callTool(
  session,
  "emcp-tools-find-element",
  { post_id: 55, widget_type: "ygency-info-box" },
  2,
);
const id =
  found.data?.elements?.[0]?.id ||
  found.data?.matches?.[0]?.id ||
  found.data?.[0]?.id ||
  "fe0b8b7";
const settings = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: 55, element_id: id },
  3,
);
const raw = settings.data?.settings || settings.data || {};
const picked = {};
for (const [key, value] of Object.entries(raw)) {
  if (/font|typo|color|title|desc|size|letter|word|align/i.test(key)) picked[key] = value;
}

process.stdout.write(
  `${JSON.stringify({ found: found.data, id, picked, keys: Object.keys(raw).slice(0, 40) }, null, 2)}\n`,
);
