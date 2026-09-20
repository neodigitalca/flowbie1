import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-about-add-widget-schema");
const listed = await callTool(session, "emcp-tools-list-skills", {}, 2);
const tools = await callTool(session, "emcp-tools-list-widgets", { search: "image-box" }, 3);
process.stdout.write(`${JSON.stringify({ skills: listed.data, tools: tools.data }, null, 2).slice(0, 3000)}\n`);
