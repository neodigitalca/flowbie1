import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-services-grid-inspect");
let id = 2;

const settings = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: 55, element_id: "aeb7d82" },
  id++,
);

const schema = await callTool(
  session,
  "emcp-tools-get-container-schema",
  { post_id: 55, element_id: "aeb7d82" },
  id++,
);

const schemaText = JSON.stringify(schema.data);
const keys = [];
for (const key of [
  "grid_columns",
  "grid_columns_grid",
  "grid_outline",
  "grid_rows_grid",
  "grid_gaps",
  "grid_auto_flow",
  "container_type",
]) {
  if (schemaText.includes(key)) keys.push(key);
}

const schemaHit = schemaText.indexOf("grid_columns");
process.stdout.write(
  `${JSON.stringify(
    {
      settings: settings.data,
      schemaKeys: keys,
      schemaSlice:
        schemaHit >= 0
          ? schemaText.slice(Math.max(0, schemaHit - 80), schemaHit + 900)
          : schemaText.slice(0, 600),
    },
    null,
    2,
  )}\n`,
);
