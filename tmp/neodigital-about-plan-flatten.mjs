import { readFileSync } from "node:fs";

const raw = JSON.parse(readFileSync("tmp/neodigital-about-tree.json", "utf8"));
const roots = raw.elements || raw.structure || raw;

function walk(node, parent, path, out) {
  if (!node || typeof node !== "object") return;
  const kids = node.elements || [];
  const item = {
    id: node.id,
    type: node.elType,
    widget: node.widgetType || "",
    kids: kids.length,
    parent: parent?.id || null,
    path,
    titles: node.settings_summary?.title || node.settings_summary?.editor || "",
    flex: node.settings_summary?.flex_direction || "",
    width: node.settings_summary?.content_width || "",
  };
  out.push(item);
  for (let i = 0; i < kids.length; i++) walk(kids[i], node, `${path}/${node.id}`, out);
}

const nodes = [];
if (Array.isArray(roots)) {
  for (const n of roots) walk(n, null, "", nodes);
} else {
  walk(roots, null, "", nodes);
}

const wrappers = nodes.filter((n) => {
  if (n.type !== "container") return false;
  if (n.kids !== 1) return false;
  const child = nodes.find((c) => c.parent === n.id);
  return child && (child.type === "widget" || (child.type === "container" && child.kids <= 1));
});

process.stdout.write(
  `${JSON.stringify(
    {
      nodeCount: nodes.length,
      containers: nodes.filter((n) => n.type === "container").length,
      widgets: nodes.filter((n) => n.type === "widget").length,
      singleChild: nodes.filter((n) => n.type === "container" && n.kids === 1).length,
      wrappers: wrappers.map((w) => ({
        id: w.id,
        parent: w.parent,
        child: nodes.find((c) => c.parent === w.id),
      })),
      outline: nodes.map((n) => `${n.path}/${n.id} ${n.type}:${n.widget || n.flex} kids=${n.kids} ${String(n.titles).slice(0, 40)}`),
    },
    null,
    2,
  )}\n`,
);
