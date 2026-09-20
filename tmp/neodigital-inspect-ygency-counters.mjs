import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 55;
const session = await openEmcp("neo-pulse-counters-inspect-ygency");
const widgets = ["53edf1d", "04e1b1a", "0ed5015"];
const results = {};
for (const w of widgets) {
  const r = await callTool(
    session,
    "emcp-tools-get-element-settings",
    { post_id: POST_ID, element_id: w },
    2,
  );
  results[w] = r.data?.settings;
}
console.log(JSON.stringify(results, null, 2));
