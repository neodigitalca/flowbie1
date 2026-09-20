import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 7605;
const session = await openEmcp("neo-pulse-inspect-7605-settings");
const elements = ["13b99946", "19938a4e", "6eb27dc1", "dac88f4"];
const results = {};
for (const elId of elements) {
  const r = await callTool(
    session,
    "emcp-tools-get-element-settings",
    { post_id: POST_ID, element_id: elId },
    2,
  );
  results[elId] = r.data?.settings;
}
console.log(JSON.stringify(results, null, 2));
