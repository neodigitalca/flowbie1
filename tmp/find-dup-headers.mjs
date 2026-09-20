import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-find-dup-headers");
const POST_ID = 10203;

// Find widgets that are nav-menu, header, or duplicate
const found = await callTool(session, "emcp-tools-find-element", {
  post_id: POST_ID,
  predicate: { elType: "widget" }
}, 1);

console.log("TOTAL WIDGETS:", found.data?.elements?.length);
const widgets = found.data?.elements || [];
for (const w of widgets) {
  if (w.widgetType?.includes("menu") || w.widgetType?.includes("nav") || w.widgetType?.includes("header") || w.widgetType?.includes("logo")) {
    console.log("NAV/HEADER WIDGET:", w.id, w.widgetType, JSON.stringify(w.settings_summary));
  }
}

// Let's also check all top level containers
const topContainers = await callTool(session, "emcp-tools-get-page-structure", { post_id: POST_ID, max_depth: 2 }, 2);
console.log("TOP LEVEL SECTIONS:", topContainers.data?.structure?.map(s => ({
  id: s.id,
  type: s.elType,
  childCount: s.elements?.length,
  children: s.elements?.map(c => ({ id: c.id, type: c.elType, widgetType: c.widgetType }))
})));
