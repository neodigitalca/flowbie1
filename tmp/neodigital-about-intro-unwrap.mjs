import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 129;
const session = await openEmcp("neo-pulse-about-intro-unwrap");
let id = 2;

const moved = [];
const slider = await callTool(
  session,
  "emcp-tools-move-element",
  { post_id: POST_ID, element_id: "6fd735a", target_parent_id: "5c4f099", position: 1 },
  id++,
);
moved.push({ id: "6fd735a", ok: slider.data?.success === true });
const grid = await callTool(
  session,
  "emcp-tools-move-element",
  { post_id: POST_ID, element_id: "6e9d357", target_parent_id: "5c4f099", position: 2 },
  id++,
);
moved.push({ id: "6e9d357", ok: grid.data?.success === true });

const removed = await callTool(
  session,
  "emcp-tools-remove-element",
  { post_id: POST_ID, element_id: "0c8b1ff" },
  id++,
);

const after = await callTool(
  session,
  "emcp-tools-get-page-structure",
  { post_id: POST_ID, max_depth: 5 },
  id++,
);
const blob = JSON.stringify(after.data);
process.stdout.write(
  `${JSON.stringify(
    {
      moved,
      removed: removed.data,
      stillHasWrap: blob.includes("0c8b1ff"),
      hasText: blob.includes("997322a"),
      hasImage: blob.includes("ac794fe"),
      slice: blob.includes("5c4f099")
        ? blob.slice(blob.indexOf("5c4f099"), blob.indexOf("5c4f099") + 1100)
        : "",
    },
    null,
    2,
  )}\n`,
);
