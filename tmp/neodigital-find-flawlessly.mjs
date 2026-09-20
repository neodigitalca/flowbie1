import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 55;
const session = await openEmcp("neo-pulse-search-flawlessly");
const el = await callTool(
  session,
  "emcp-tools-find-element",
  { post_id: POST_ID, text: "function flawlessly" },
  2,
);
console.log(JSON.stringify(el.data, null, 2));
