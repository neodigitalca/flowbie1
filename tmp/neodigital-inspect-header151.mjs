import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-inspect-header");
const header151 = await callTool(
  session,
  "emcp-tools-get-page-structure",
  { post_id: 151, max_depth: 8 },
  2,
);
console.log(JSON.stringify({ header: header151.data }, null, 2));
