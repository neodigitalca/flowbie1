import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 7605;
const session = await openEmcp("neo-pulse-inspect-7605");
const struct = await callTool(
  session,
  "emcp-tools-get-page-structure",
  { post_id: POST_ID, max_depth: 8 },
  2,
);
console.log("Structure of 7605:", JSON.stringify(struct.data, null, 2));

const pageSettings = await callTool(
  session,
  "emcp-tools-get-settings",
  { post_id: POST_ID },
  3,
);
console.log("Page Settings of 7605:", JSON.stringify(pageSettings.data, null, 2));
