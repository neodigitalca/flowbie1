import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 10203;
const session = await openEmcp("neo-inspect-margins");
const ids = ["3553037", "fb92c02", "f3851d6", "cad7f69", "ffbd703", "4c1e062", "f51d2a0"];
let seq = 1;

for (const id of ids) {
  const r = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: id }, seq++);
  const s = r.data?.settings || {};
  console.log(`\n=== ${id} ===`);
  console.log(JSON.stringify({
    _title: s._title,
    width: s.width,
    margin: s.margin,
    padding: s.padding,
    flex_direction: s.flex_direction,
    flex_align_items: s.flex_align_items,
    custom_css: s.custom_css?.slice(0, 200),
  }, null, 2));
}
