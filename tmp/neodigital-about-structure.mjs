import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-about-structure");
let id = 2;

const listed = await callTool(session, "emcp-tools-list-pages", { search: "About" }, id++);
process.stdout.write(`${JSON.stringify({ listed: listed.data }, null, 2).slice(0, 4000)}\n`);
