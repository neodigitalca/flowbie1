import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 129;
const session = await openEmcp("neo-pulse-about-restore-grids");
let id = 2;

const updates = [
  {
    element_id: "6e9d357",
    settings: {
      container_type: "grid",
      grid_columns_grid: { size: 2, sizes: [], unit: "fr" },
      grid_columns_grid_tablet: { size: 2, sizes: [], unit: "fr" },
      grid_columns_grid_mobile: { size: 1, sizes: [], unit: "fr" },
      grid_align_items: "center",
    },
  },
  {
    element_id: "86db9e8",
    settings: {
      container_type: "grid",
      grid_columns_grid: { size: 3, sizes: [], unit: "fr" },
      grid_columns_grid_tablet: { size: 2, sizes: [], unit: "fr" },
      grid_columns_grid_mobile: { size: 1, sizes: [], unit: "fr" },
      grid_align_items: "start",
      grid_justify_items: "center",
    },
  },
  {
    element_id: "3d2abb0",
    settings: {
      container_type: "grid",
      grid_columns_grid: { size: 3, sizes: [], unit: "fr" },
      grid_columns_grid_tablet: { size: 1, sizes: [], unit: "fr" },
      grid_columns_grid_mobile: { size: 1, sizes: [], unit: "fr" },
    },
  },
  {
    element_id: "8497e8d",
    settings: {
      container_type: "grid",
      grid_columns_grid: { size: 2, sizes: [], unit: "fr" },
      grid_columns_grid_tablet: { size: 1, sizes: [], unit: "fr" },
      grid_columns_grid_mobile: { size: 1, sizes: [], unit: "fr" },
      grid_align_items: "center",
    },
  },
];

const results = [];
for (const item of updates) {
  const res = await callTool(
    session,
    "emcp-tools-update-element",
    { post_id: POST_ID, ...item },
    id++,
  );
  results.push({ id: item.element_id, ok: res.data?.success === true });
}

process.stdout.write(`${JSON.stringify({ results }, null, 2)}\n`);
