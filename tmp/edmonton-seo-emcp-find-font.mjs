import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-edmonton-seo-find-font");
const themeFont = await callTool(
  session,
  "emcp-tools-search-files",
  {
    query: "font-family",
    path: "wp-content/themes",
    extensions: ["css"],
    max_results: 30,
  },
  2,
);
const textEditor = await callTool(
  session,
  "emcp-tools-search-files",
  {
    query: "elementor-widget-text-editor",
    path: "wp-content/themes",
    extensions: ["css"],
    max_results: 20,
  },
  3,
);
const stroke = await callTool(
  session,
  "emcp-tools-search-files",
  {
    query: "text-stroke",
    path: "wp-content",
    extensions: ["css"],
    max_results: 20,
  },
  4,
);
const plugins = await callTool(session, "emcp-tools-list-plugins", {}, 5);
process.stdout.write(
  `${JSON.stringify(
    {
      themeFont: themeFont.data,
      textEditor: textEditor.data,
      stroke: stroke.data,
      plugins: plugins.data,
    },
    null,
    2,
  )}\n`,
);
