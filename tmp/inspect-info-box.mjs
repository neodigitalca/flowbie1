import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-inspect-info-box");
const res = await callTool(session, "emcp-tools-get-element-settings", {
  post_id: 10203,
  element_id: "7120c33"
}, 1);

console.log("INFO BOX SETTINGS:", JSON.stringify(res, null, 2));
