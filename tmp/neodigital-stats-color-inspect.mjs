import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-stats-color-inspect");
let id = 2;
const settings = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: 55, element_id: "c8e2940" },
  id++,
);
const kit = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: 5564 },
  id++,
);
const s = settings.data?.settings || {};
const k = kit.data?.settings || kit.data || {};
const colorKeys = Object.entries(s)
  .filter(([key, val]) => /color|digit|sign|label|number|accent/i.test(key) && val)
  .slice(0, 80);
const kitColors = {};
for (const [key, val] of Object.entries(k)) {
  if (/system_colors|custom_colors|accent|primary|secondary/i.test(key)) {
    kitColors[key] = val;
  }
}
process.stdout.write(
  `${JSON.stringify({ colorKeys: Object.fromEntries(colorKeys), kitColors }, null, 2)}\n`,
);
