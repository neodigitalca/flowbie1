import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-inspect-fbox");
const struct = await callTool(session, "emcp-tools-get-page-structure", { post_id: 673, max_depth: 6 }, 1);

// Find element with widgetType: ygency-feature-box
function findFbox(nodes) {
  for (const n of nodes) {
    if (n.widgetType === "ygency-feature-box") return n;
    if (n.elements) {
      const found = findFbox(n.elements);
      if (found) return found;
    }
  }
  return null;
}

const fboxNode = findFbox(struct.data?.structure || []);
console.log("FBOX NODE:", JSON.stringify(fboxNode, null, 2));

if (fboxNode) {
  const settings = await callTool(session, "emcp-tools-get-element-settings", {
    post_id: 673,
    element_id: fboxNode.id
  }, 2);
  console.log("FBOX SETTINGS:", JSON.stringify(settings, null, 2));
}
