import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 10203;
const session = await openEmcp("neo-find-neg-margin");
const struct = await callTool(session, "emcp-tools-get-page-structure", { post_id: POST_ID, max_depth: 12 }, 1);

const ids = [];
function walk(nodes) {
  for (const n of nodes || []) {
    ids.push(n.id);
    if (n.elements) walk(n.elements);
  }
}
walk(struct.data?.structure || []);

let seq = 2;
const bad = [];
for (const id of ids) {
  const r = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: id }, seq++);
  const s = r.data?.settings;
  if (!s) continue;
  const margin = s.margin;
  const width = s.width;
  const checkNeg = (obj, key) => {
    if (!obj || typeof obj !== "object") return;
    for (const [k, v] of Object.entries(obj)) {
      if (k.includes("margin") || k.includes("width") || k === "left" || k === "right") {
        if (String(v).startsWith("-")) bad.push({ id, key: `${key}.${k}`, v });
      }
    }
  };
  checkNeg(margin, "margin");
  checkNeg(width, "width");
  if (s.custom_css && s.custom_css.includes("margin") && s.custom_css.includes("-")) {
    bad.push({ id, custom_css: s.custom_css.slice(0, 120) });
  }
  if (bad.length > 30) break;
}

console.log("NEGATIVE / SUSPICIOUS:", JSON.stringify(bad.slice(0, 25), null, 2));
console.log("Scanned", ids.length, "elements");
