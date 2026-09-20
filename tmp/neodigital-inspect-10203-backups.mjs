import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-inspect-edmonton-seo-backups");
const POST_ID = 10203;

const backups = await callTool(session, "emcp-tools-list-backups", { post_id: POST_ID }, 1);
console.log("BACKUPS:", JSON.stringify(backups, null, 2));

// Also let's inspect the entire element tree of post 10203 to see what is on this page!
const structure = await callTool(session, "emcp-tools-get-page-structure", { post_id: POST_ID, max_depth: 10 }, 2);
import fs from "fs";
fs.writeFileSync("tmp/edmonton-seo-structure.json", JSON.stringify(structure, null, 2));
console.log("Saved structure to tmp/edmonton-seo-structure.json");
