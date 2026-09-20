import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-test-html-widget");
const schema = await callTool(
  session,
  "emcp-tools-get-widget-schema",
  { widget_type: "html" },
  2,
);
console.log(JSON.stringify({ htmlSchema: schema.data }, null, 2));
