import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-about-team-schema");
let id = 2;

const listed = await callTool(
  session,
  "emcp-tools-list-widgets",
  {},
  id++,
);
const blob = JSON.stringify(listed.data).toLowerCase();
const hits = [];
for (const key of ["image-box", "image_box", "team", "member", "info-box", "person", "ygency-team", "icon-box"]) {
  if (blob.includes(key)) hits.push(key);
}

const schema = await callTool(
  session,
  "emcp-tools-get-widget-schema",
  { widget_type: "image-box" },
  id++,
);

process.stdout.write(
  `${JSON.stringify(
    {
      hits,
      listSlice: JSON.stringify(listed.data).slice(0, 2500),
      schemaKeys: schema.data ? Object.keys(schema.data) : [],
      schemaSlice: JSON.stringify(schema.data).slice(0, 2500),
    },
    null,
    2,
  )}\n`,
);
