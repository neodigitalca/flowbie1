import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-about-inspect");
let id = 2;
const pages = await callTool(session, "emcp-tools-list-pages", { search: "about", per_page: 20 }, id++);
const about = (pages.data?.pages || pages.data?.items || pages.data || []).find?.((p) =>
  String(p?.link || p?.url || p?.slug || "").includes("about"),
);
const postId = about?.id || about?.ID || 11;

const titles = await callTool(
  session,
  "emcp-tools-find-element",
  { post_id: postId, widget_type: "ygency-section-title" },
  id++,
);
const icons = await callTool(
  session,
  "emcp-tools-find-element",
  { post_id: postId, widget_type: "icon-box" },
  id++,
);
const globals = await callTool(session, "emcp-tools-get-global-settings", {}, id++);
const g = globals.data || {};

process.stdout.write(
  `${JSON.stringify(
    {
      postId,
      pageKeys: about ? Object.keys(about) : Object.keys(pages.data || {}),
      titles: titles.data,
      icons: icons.data,
      globalKeys: Object.keys(g),
      custom: g.custom_colors || g.settings?.custom_colors || g.kit_custom_colors,
      system: g.system_colors || g.settings?.system_colors,
    },
    null,
    2,
  )}\n`,
);
