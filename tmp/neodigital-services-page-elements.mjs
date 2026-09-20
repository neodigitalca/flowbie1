import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 131;
const session = await openEmcp("neo-pulse-services-page-structure");
const structure = await callTool(
  session,
  "emcp-tools-get-page-structure",
  { post_id: POST_ID, max_depth: 8 },
  2,
);

function walk(node, list) {
  if (!node || typeof node !== "object") return;
  list.push({
    id: node.id,
    elType: node.elType,
    widgetType: node.widgetType,
    title: node.settings_summary?.title || node.settings_summary?.title_text || node.settings_summary?.editor || "",
  });
  for (const child of node.elements || []) walk(child, list);
}

const list = [];
for (const root of structure.data?.structure || []) walk(root, list);
process.stdout.write(`${JSON.stringify({ count: list.length, items: list }, null, 2)}\n`);
