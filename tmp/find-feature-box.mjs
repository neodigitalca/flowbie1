import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-find-feature-box");
const res = await callTool(session, "emcp-tools-query", {
  sql: "SELECT post_id, meta_value FROM wp_postmeta WHERE meta_key = '_elementor_data' AND meta_value LIKE '%ygency-feature-box%' LIMIT 3"
}, 1);

console.log("FEATURE BOX POSTS:", res.data?.rows?.map(r => r.post_id));
