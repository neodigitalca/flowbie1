import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 55;
const GRID = "aeb7d82";

const session = await openEmcp("neo-pulse-services-two-cols");
const updated = await callTool(
  session,
  "emcp-tools-update-element",
  {
    post_id: POST_ID,
    element_id: GRID,
    settings: {
      grid_columns_grid: { size: 2, sizes: [], unit: "fr" },
    },
  },
  2,
);
const after = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: POST_ID, element_id: GRID },
  3,
);
const cols = after.data?.settings?.grid_columns_grid;
process.stdout.write(
  `${JSON.stringify(
    {
      update: updated.data,
      columns: cols,
      tablet: after.data?.settings?.grid_columns_grid_tablet,
    },
    null,
    2,
  )}\n`,
);
