import { callTool, openEmcp } from "./emcp-http.mjs";
import fs from "fs";

const session = await openEmcp("neo-hero-live");
const struct = await callTool(session, "emcp-tools-get-page-structure", { post_id: 10203, max_depth: 8 }, 1);

function findNode(nodes, id) {
  for (const n of nodes || []) {
    if (n.id === id) return n;
    const f = findNode(n.elements, id);
    if (f) return f;
  }
  return null;
}

const hero = findNode(struct.data?.structure, "afa170d");
fs.writeFileSync("tmp/hero-live.json", JSON.stringify(hero, null, 2));
console.log(JSON.stringify(hero, null, 2).slice(0, 4000));
