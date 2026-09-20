import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 7605;
const session = await openEmcp("neo-pulse-check-6eb27dc1");
const r = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: POST_ID, element_id: "6eb27dc1" },
  2,
);
console.log(JSON.stringify(r.data?.settings, null, 2));
