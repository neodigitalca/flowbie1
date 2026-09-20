import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-dump-355");
const struct = await callTool(session, "emcp-tools-get-page-structure", { post_id: 10203, max_depth: 12 }, 1);

function findNode(nodes, id) {
  for (const n of nodes || []) {
    if (n.id === id) return n;
    const f = findNode(n.elements, id);
    if (f) return f;
  }
  return null;
}

const n355 = findNode(struct.data?.structure, "3553037");
import fs from "fs";
fs.writeFileSync("tmp/3553037-current.json", JSON.stringify(n355, null, 2));
console.log("Saved 3553037-current.json");

const nCad = findNode(struct.data?.structure, "cad7f69");
fs.writeFileSync("tmp/cad7f69-current.json", JSON.stringify(nCad, null, 2).slice(0, 8000));
console.log("cad7f69 children:", nCad?.elements?.length);
