import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-stats-inspect");
const found = await callTool(
  session,
  "emcp-tools-find-element",
  { post_id: 55, widget_type: "qi_addons_for_elementor_counter" },
  2,
);
const structure = await callTool(
  session,
  "emcp-tools-get-page-structure",
  { post_id: 55, max_depth: 8 },
  3,
);
const blob = JSON.stringify(structure.data);
const hit = blob.indexOf("a7f6ade");
process.stdout.write(
  `${JSON.stringify(
    {
      count: found.data?.count || found.data?.matches?.length,
      matches: found.data?.matches,
      statsSlice: hit >= 0 ? blob.slice(hit, hit + 3500) : blob.slice(0, 800),
    },
    null,
    2,
  )}\n`,
);
