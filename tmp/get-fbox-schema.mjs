import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-get-fbox-schema");
const schema = await callTool(session, "emcp-tools-get-widget-schema", {
  widget_type: "ygency-feature-box",
  full: true
}, 1);

console.log("FBOX SCHEMA CONTROLS:", JSON.stringify(schema, null, 2));
