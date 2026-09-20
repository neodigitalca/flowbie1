import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-search-projects-in-mind");
const templates = await callTool(
  session,
  "emcp-tools-list-theme-templates",
  {},
  2,
);
console.log("Templates:", JSON.stringify(templates.data, null, 2));

const posts = await callTool(
  session,
  "emcp-tools-search-content",
  { query: "Have Any Projects In Mind" },
  3,
);
console.log("Search results:", JSON.stringify(posts.data, null, 2));
