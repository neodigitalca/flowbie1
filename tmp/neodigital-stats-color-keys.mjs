import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-stats-color-keys");
const settings = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: 55, element_id: "c8e2940" },
  2,
);
const s = settings.data?.settings || {};
process.stdout.write(`${JSON.stringify(Object.keys(s).sort(), null, 2)}\n`);
