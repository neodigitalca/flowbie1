import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-inspect-f51d");
const res = await callTool(session, "emcp-tools-get-element-settings", {
  post_id: 10203,
  element_id: "f51d2a0"
}, 1);

console.log("F51D2A0 SETTINGS:", JSON.stringify(res, null, 2));
