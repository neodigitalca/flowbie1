import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-services-structure");
const structure = await callTool(
  session,
  "emcp-tools-get-page-structure",
  { post_id: 55, max_depth: 8 },
  2,
);
const found = await callTool(
  session,
  "emcp-tools-find-element",
  { post_id: 55, widget_type: "ygency-info-box" },
  3,
);

process.stdout.write(
  `${JSON.stringify({ infoBoxes: found.data, structure: structure.data }, null, 2)}\n`,
);
