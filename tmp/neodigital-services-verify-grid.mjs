import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-services-verify");
const found = await callTool(
  session,
  "emcp-tools-find-element",
  { post_id: 55, widget_type: "ygency-info-box" },
  2,
);
const structure = await callTool(
  session,
  "emcp-tools-get-page-structure",
  { post_id: 55, max_depth: 7 },
  3,
);
const blob = JSON.stringify(structure.data);
const gridAt = blob.indexOf("aeb7d82");
process.stdout.write(
  `${JSON.stringify(
    {
      count: found.data?.count || found.data?.matches?.length,
      matches: found.data?.matches,
      gridCtx: gridAt >= 0 ? blob.slice(gridAt, gridAt + 2500) : blob.slice(0, 800),
    },
    null,
    2,
  )}\n`,
);
