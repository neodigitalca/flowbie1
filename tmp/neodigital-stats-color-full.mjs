import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-stats-color-full");
const settings = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: 55, element_id: "c8e2940" },
  2,
);
const s = settings.data?.settings || {};
const keys = Object.keys(s).filter((key) =>
  /digit|stroke|label|sign|title|color|icon/i.test(key),
);
const picked = {};
for (const key of keys) picked[key] = s[key];
process.stdout.write(`${JSON.stringify(picked, null, 2)}\n`);
