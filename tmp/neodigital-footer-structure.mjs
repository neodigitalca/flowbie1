import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 163;
const session = await openEmcp("neo-pulse-footer-inspect");
const structure = await callTool(
  session,
  "emcp-tools-get-page-structure",
  { post_id: POST_ID, max_depth: 8 },
  2,
);
process.stdout.write(`${JSON.stringify(structure.data, null, 2)}\n`);
