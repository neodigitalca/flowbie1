import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 10203;
const session = await openEmcp("neo-inspect-cad");
const ids = ["2c71476", "d73fdd3", "cad7f69", "3553037", "afa170d"];
let seq = 1;
for (const id of ids) {
  const r = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: id }, seq++);
  const s = r.data?.settings || {};
  console.log(id, JSON.stringify({
    width: s.width,
    margin: s.margin,
    padding: s.padding,
    flex_direction: s.flex_direction,
    content_width: s.content_width,
    min_height: s.min_height,
  }));
}
