import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-inspect-all-children");
const ids = [
  "4c1e062", "f7b6948", "e997763", "2d20944", "c8ba8a3",
  "b79ecfb", "d65ad74", "e0a0811", "069484a", "46f0e3c"
];

const results = [];
let seq = 1;
for (const id of ids) {
  const r = await callTool(session, "emcp-tools-get-element-settings", {
    post_id: 10203,
    element_id: id
  }, seq++);
  const s = r.data?.settings || {};
  results.push({
    id,
    title: s._title,
    width: s.width,
    flex_direction: s.flex_direction,
    margin: s.margin,
    padding: s.padding
  });
}

console.log("ALL CHILDREN SETTINGS:", JSON.stringify(results, null, 2));
