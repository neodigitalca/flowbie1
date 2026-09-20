import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 55;
const session = await openEmcp("neo-pulse-inspect-1a69bf4");
const struct = await callTool(
  session,
  "emcp-tools-get-page-structure",
  { post_id: POST_ID, max_depth: 8 },
  2,
);

function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.elements) {
      const f = findNode(n.elements, id);
      if (f) return f;
    }
  }
  return null;
}

const node = findNode(struct.data.structure, "1a69bf4");
console.log(JSON.stringify(node, null, 2));
