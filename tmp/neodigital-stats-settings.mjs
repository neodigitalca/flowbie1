import { callTool, openEmcp } from "./emcp-http.mjs";

const IDS = ["a7f6ade", "bebcc35", "3d62011", "32d6155", "a136cf5"];
const session = await openEmcp("neo-pulse-stats-settings");
let id = 2;
const out = {};
for (const element_id of IDS) {
  const res = await callTool(
    session,
    "emcp-tools-get-element-settings",
    { post_id: 55, element_id },
    id++,
  );
  const s = res.data?.settings || {};
  out[element_id] = {
    container_type: s.container_type,
    flex_direction: s.flex_direction,
    content_width: s.content_width,
    width: s.width,
    flex_grow: s.flex_grow,
    flex_shrink: s.flex_shrink,
    flex_basis: s.flex_basis,
    _flex_size: s._flex_size,
    width_tablet: s.width_tablet,
    width_mobile: s.width_mobile,
    boxed_width: s.boxed_width,
  };
}
process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
