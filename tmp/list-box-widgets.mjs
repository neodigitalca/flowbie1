import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-list-widgets");
const res = await callTool(session, "emcp-tools-list-widgets", {}, 1);

const widgets = res.data?.widgets || res.data || [];
const boxWidgets = widgets.filter(w => {
  const name = typeof w === "string" ? w : (w.name || w.title || "");
  return name.toLowerCase().includes("box");
});

console.log("BOX WIDGETS:", JSON.stringify(boxWidgets, null, 2));
