import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 55;
const WIDGETS = ["c8e2940", "0024fe2", "4996389"];
const session = await openEmcp("neo-pulse-counters-inspect");
let id = 2;

const results = [];
for (const w of WIDGETS) {
  const res = await callTool(
    session,
    "emcp-tools-get-element-settings",
    { post_id: POST_ID, element_id: w },
    id++,
  );
  results.push({ id: w, settings: res.data?.settings });
}

process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
