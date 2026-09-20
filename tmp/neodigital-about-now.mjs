import { writeFileSync } from "node:fs";
import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-about-now");
const structure = await callTool(
  session,
  "emcp-tools-get-page-structure",
  { post_id: 129, max_depth: 10 },
  2,
);
writeFileSync("tmp/neodigital-about-now.json", `${JSON.stringify(structure.data, null, 2)}\n`);

function walk(node, parent, empty, outline) {
  if (!node || typeof node !== "object") return;
  const kids = node.elements || [];
  const title = node.settings_summary?.title || node.widgetType || node.settings_summary?.flex_direction || "";
  outline.push({
    id: node.id,
    type: node.elType,
    widget: node.widgetType || "",
    kids: kids.length,
    parent: parent?.id || null,
    title: String(title).slice(0, 50),
  });
  if (node.elType === "container" && kids.length === 0) {
    empty.push({ id: node.id, parent: parent?.id || null });
  }
  for (const child of kids) walk(child, node, empty, outline);
}

const empty = [];
const outline = [];
for (const root of structure.data?.structure || []) walk(root, null, empty, outline);
process.stdout.write(`${JSON.stringify({ empty, outline }, null, 2)}\n`);
