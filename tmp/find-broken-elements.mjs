import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 10203;
const session = await openEmcp("neo-find-broken");
const struct = await callTool(session, "emcp-tools-get-page-structure", { post_id: POST_ID, max_depth: 10 }, 1);

function walk(nodes, out = []) {
  for (const n of nodes || []) {
    out.push({
      id: n.id,
      elType: n.elType,
      widgetType: n.widgetType,
      title: n.settings_summary?.title,
    });
    if (n.elements) walk(n.elements, out);
  }
  return out;
}

const all = walk(struct.data?.structure || []);
const fbox = all.filter(x => x.widgetType === "ygency-feature-box");
const sec355 = all.filter(x => ["3553037", "fb92c02", "f3851d6", "4c1e062", "d21933e", "baffa6f"].includes(x.id));

console.log("FEATURE BOXES:", JSON.stringify(fbox, null, 2));
console.log("KEY NODES:", JSON.stringify(sec355, null, 2));
