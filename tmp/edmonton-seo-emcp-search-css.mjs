import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-edmonton-seo-search-css");
const widget = await callTool(
  session,
  "emcp-tools-search-files",
  {
    query: "c28b26d",
    path: "wp-content/uploads/elementor/css",
    extensions: ["css"],
    max_results: 20,
  },
  2,
);
const lato = await callTool(
  session,
  "emcp-tools-search-files",
  {
    query: "Lato",
    path: "wp-content/uploads/elementor/css",
    extensions: ["css"],
    max_results: 20,
  },
  3,
);
const post = await callTool(
  session,
  "emcp-tools-read-file",
  { path: "wp-content/uploads/elementor/css/post-10203.css", offset: 1, limit: 80 },
  4,
);
process.stdout.write(
  `${JSON.stringify({ widget: widget.data, lato: lato.data, postHead: post.data }, null, 2)}\n`,
);
