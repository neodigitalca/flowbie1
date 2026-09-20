import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-inspect-edmonton-seo-changes");
const POST_ID = 10203;

// list changes for post 10203
const changes = await callTool(session, "emcp-tools-list-changes", { limit: 100 }, 1);
const postChanges = changes.data?.changes?.filter(c => c.rollback?.post_id === POST_ID || c.target?.includes("10203") || c.target?.includes("Edmonton SEO"));

console.log("POST 10203 CHANGES:", JSON.stringify(postChanges, null, 2));
