import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-text-editor-schema");
const schema = await callTool(
  session,
  "emcp-tools-get-widget-schema",
  { widget_type: "text-editor" },
  2,
);
process.stdout.write(`${JSON.stringify({ ok: schema.data?.success, controls: Object.keys(schema.data?.controls || {}) }, null, 2)}\n`);
