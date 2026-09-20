import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-find-tab");
const found = await callTool(session, "emcp-tools-find-element", {
  post_id: 10203,
  search_text: "What is Edmonton SEO",
}, 1);
console.log(JSON.stringify(found.data, null, 2));
