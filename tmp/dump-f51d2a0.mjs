import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-inspect-f51d2a0");
const struct = await callTool(session, "emcp-tools-get-page-structure", { post_id: 10203, max_depth: 8 }, 1);

function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.elements) {
      const found = findNode(n.elements, id);
      if (found) return found;
    }
  }
  return null;
}

const f51dNode = findNode(struct.data?.structure || [], "f51d2a0");
import fs from "fs";
fs.writeFileSync("tmp/f51d2a0-structure.json", JSON.stringify(f51dNode, null, 2));
console.log("Saved f51d2a0 structure. Rows count:", f51dNode?.elements?.length);
