import { callTool, openEmcp } from "./emcp-http.mjs";
import fs from "fs";

const POST_ID = 10203;
const session = await openEmcp("neo-f51-live");
const struct = await callTool(session, "emcp-tools-get-page-structure", { post_id: POST_ID, max_depth: 12 }, 1);

function findNode(nodes, id) {
  for (const n of nodes || []) {
    if (n.id === id) return n;
    const f = findNode(n.elements, id);
    if (f) return f;
  }
  return null;
}

const f51 = findNode(struct.data?.structure, "f51d2a0");
fs.writeFileSync("tmp/f51d2a0-live.json", JSON.stringify(f51, null, 2));

// Find parent section containing f51d2a0
function findParent(nodes, targetId, parent = null) {
  for (const n of nodes || []) {
    if (n.id === targetId) return parent;
    const p = findParent(n.elements, targetId, n);
    if (p) return p;
  }
  return null;
}

const parent = findParent(struct.data?.structure, "f51d2a0");
console.log("F51 parent:", parent?.id, parent?.settings_summary);
console.log("F51 rows:", f51?.elements?.length);
