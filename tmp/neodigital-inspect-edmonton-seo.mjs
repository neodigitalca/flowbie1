import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-inspect-edmonton-seo");
const POST_ID = 10203;

const structure = await callTool(session, "emcp-tools-get-page-structure", { post_id: POST_ID, max_depth: 5 }, 1);
const pageSettings = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: "" }, 2);
const changes = await callTool(session, "emcp-tools-list-changes", { post_id: POST_ID, limit: 10 }, 3);

console.log("STRUCTURE:", JSON.stringify(structure, null, 2).slice(0, 3000));
console.log("PAGE SETTINGS:", JSON.stringify(pageSettings, null, 2).slice(0, 1500));
console.log("CHANGES:", JSON.stringify(changes, null, 2));
