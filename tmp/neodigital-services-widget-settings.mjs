import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 131;
const session = await openEmcp("neo-pulse-services-widget-settings");
const res = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: POST_ID, element_id: "a29351d" },
  2,
);
process.stdout.write(`${JSON.stringify(res.data, null, 2)}\n`);
