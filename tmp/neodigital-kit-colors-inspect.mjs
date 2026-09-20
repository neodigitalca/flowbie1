import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-kit-colors-inspect");
const kit = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: 5564 },
  2,
);
const s = kit.data?.settings || {};
const textColors = {};
for (const [k, v] of Object.entries(s)) {
  if (/body|text|color/i.test(k)) {
    textColors[k] = v;
  }
}
process.stdout.write(`${JSON.stringify({ textColors }, null, 2)}\n`);
