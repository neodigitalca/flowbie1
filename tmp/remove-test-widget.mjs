import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-cleanup-test");
const res = await callTool(session, "emcp-tools-remove-element", {
  post_id: 10203,
  element_id: "312bacc"
}, 1);

console.log("REMOVED TEST WIDGET:", res.data);
