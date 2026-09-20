import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 55;
const ROW = "bebcc35";
const WIDGETS = ["c8e2940", "0024fe2", "4996389"];
const WRAPPERS = ["3d62011", "32d6155", "a136cf5"];

const session = await openEmcp("neo-pulse-stats-one-container");
let id = 2;

const grid = await callTool(
  session,
  "emcp-tools-update-element",
  {
    post_id: POST_ID,
    element_id: ROW,
    settings: {
      container_type: "grid",
      grid_columns_grid: { size: 3, sizes: [], unit: "fr" },
      grid_columns_grid_tablet: { size: 3, sizes: [], unit: "fr" },
      grid_columns_grid_mobile: { size: 1, sizes: [], unit: "fr" },
    },
  },
  id++,
);

const moved = [];
for (let i = 0; i < WIDGETS.length; i++) {
  const res = await callTool(
    session,
    "emcp-tools-move-element",
    { post_id: POST_ID, element_id: WIDGETS[i], target_parent_id: ROW, position: i },
    id++,
  );
  moved.push({ id: WIDGETS[i], ok: res.data });
}

const removed = [];
for (const wrapper of WRAPPERS) {
  const res = await callTool(
    session,
    "emcp-tools-remove-element",
    { post_id: POST_ID, element_id: wrapper },
    id++,
  );
  removed.push({ id: wrapper, ok: res.data });
}

const found = await callTool(
  session,
  "emcp-tools-find-element",
  { post_id: POST_ID, widget_type: "qi_addons_for_elementor_counter" },
  id++,
);
const structure = await callTool(
  session,
  "emcp-tools-get-page-structure",
  { post_id: POST_ID, max_depth: 7 },
  id++,
);
const blob = JSON.stringify(structure.data);
const hit = blob.indexOf("bebcc35");

process.stdout.write(
  `${JSON.stringify(
    {
      grid: grid.data,
      moved,
      removed,
      widgetCount: found.data?.count || found.data?.matches?.length,
      stillHasWrappers: WRAPPERS.some((w) => blob.includes(`"${w}"`)),
      rowSlice: hit >= 0 ? blob.slice(hit, hit + 1600) : "",
    },
    null,
    2,
  )}\n`,
);
