import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 10203;
const session = await openEmcp("neo-emergency-10203");
let seq = 1;

const backups = await callTool(session, "emcp-tools-list-backups", { post_id: POST_ID }, seq++);
const changes = await callTool(session, "emcp-tools-list-changes", { post_id: POST_ID, limit: 15 }, seq++);
const struct = await callTool(session, "emcp-tools-get-page-structure", { post_id: POST_ID, max_depth: 4 }, seq++);

console.log("BACKUPS:", JSON.stringify(backups.data, null, 2).slice(0, 2000));
console.log("RECENT CHANGES:", JSON.stringify(changes.data, null, 2).slice(0, 3000));
console.log("TOP STRUCTURE:", JSON.stringify(struct.data?.structure?.map(s => ({ id: s.id, elType: s.elType, children: s.elements?.length })), null, 2));
