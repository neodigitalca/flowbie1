import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 55;
const session = await openEmcp("neo-pulse-inspect-b53d445");
const struct = await callTool(
  session,
  "emcp-tools-get-page-structure",
  { post_id: POST_ID, max_depth: 8 },
  2,
);

// Find b53d445 in struct.data
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

const node = findNode(struct.data.structure, "b53d445");
console.log(JSON.stringify(node, null, 2));
