import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 10203;
const session = await openEmcp("neo-inspect-row-355");
const ids = ["70e79f8", "1939589", "6edfb5a", "fb92c02", "f3851d6", "a48b7dc"];
let seq = 1;
for (const id of ids) {
  const r = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: id }, seq++);
  const s = r.data?.settings || {};
  console.log(id, JSON.stringify({
    width: s.width,
    margin: s.margin,
    padding: s.padding,
    flex_direction: s.flex_direction,
    flex_grow: s.flex_grow,
    background_background: s.background_background,
    background_color: s.background_color,
  }, null, 2));
}
