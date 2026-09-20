import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-inspect-service-structures");

const localSeo = await callTool(session, "emcp-tools-get-page-structure", { post_id: 10439, max_depth: 3 }, 1);
const webDesign = await callTool(session, "emcp-tools-get-page-structure", { post_id: 4017, max_depth: 3 }, 2);

console.log("LOCAL SEO SECTIONS:", localSeo.data?.structure?.map(s => ({
  id: s.id,
  type: s.elType,
  title: s.settings_summary?._title,
  childCount: s.elements?.length,
  elements: s.elements?.map(c => ({ id: c.id, title: c.settings_summary?._title, type: c.elType, widgetType: c.widgetType, text: c.settings_summary?.title || c.settings_summary?.editor?.slice(0, 40) }))
})));

console.log("WEB DESIGN SECTIONS:", webDesign.data?.structure?.map(s => ({
  id: s.id,
  type: s.elType,
  title: s.settings_summary?._title,
  childCount: s.elements?.length,
  elements: s.elements?.map(c => ({ id: c.id, title: c.settings_summary?._title, type: c.elType, widgetType: c.widgetType, text: c.settings_summary?.title || c.settings_summary?.editor?.slice(0, 40) }))
})));
