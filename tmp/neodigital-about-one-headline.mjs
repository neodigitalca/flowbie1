import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 129;
const KEEP = "0f70bcb";
const DROP = "251eaca";

const session = await openEmcp("neo-pulse-about-one-headline");
let id = 2;
const first = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: POST_ID, element_id: KEEP },
  id++,
);
const second = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: POST_ID, element_id: DROP },
  id++,
);
const a = first.data?.settings?.title || "";
const b = second.data?.settings?.title || "";
process.stdout.write(`${JSON.stringify({ a, b, firstSize: first.data?.settings?.header_size, secondSize: second.data?.settings?.header_size }, null, 2)}\n`);
