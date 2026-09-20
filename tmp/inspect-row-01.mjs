import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-inspect-4c1e");
const res = await callTool(session, "emcp-tools-get-element-settings", {
  post_id: 10203,
  element_id: "4c1e062"
}, 1);

console.log("ROW 01 (4c1e062) SETTINGS:", JSON.stringify(res, null, 2));
