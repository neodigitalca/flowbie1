import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 55;
const session = await openEmcp("neo-pulse-home-split-inspect");
const s40 = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: "40d6f4a" }, 2);
const s3a = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: "3ad54d9" }, 3);
const s78 = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: "782eeb5" }, 4);

// Also let's inspect the child widgets of 40d6f4a, 3ad54d9, 782eeb5
const structure = await callTool(session, "emcp-tools-get-page-structure", { post_id: POST_ID, max_depth: 6 }, 5);

function findNode(nodes, targetId) {
  for (const n of nodes || []) {
    if (n.id === targetId) return n;
    const found = findNode(n.elements, targetId);
    if (found) return found;
  }
  return null;
}

const n40 = findNode(structure.data?.structure, "40d6f4a");
const n3a = findNode(structure.data?.structure, "3ad54d9");
const n78 = findNode(structure.data?.structure, "782eeb5");

process.stdout.write(JSON.stringify({ n40, n3a, n78 }, null, 2) + "\n");
