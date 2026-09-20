import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-query-global-css");
const res = await callTool(session, "emcp-tools-query", {
  sql: "SELECT option_name, SUBSTRING(option_value, 1, 200) as val_preview FROM wp_options WHERE option_name LIKE '%pulse%' OR option_name LIKE '%global_css%'"
}, 1);

console.log("QUERY RESULT:", JSON.stringify(res, null, 2));
