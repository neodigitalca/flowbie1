import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 55;
const session = await openEmcp("neo-pulse-counters-inspect-all");
const w = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: POST_ID, element_id: "0024fe2" },
  2,
);
console.log(JSON.stringify(w.data, null, 2));
