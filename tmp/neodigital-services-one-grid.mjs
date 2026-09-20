import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 55;
const GRID = "aeb7d82";
const BOXES = [
  "fe0b8b7",
  "a4891eb",
  "3f36645",
  "d8a4ec2",
  "f617485",
  "e7dc475",
  "e53f689",
  "a4c0ff0",
];
const WRAPPERS = [
  "f7df007",
  "9f6c584",
  "0cb5133",
  "671a574",
  "245f077",
  "7209c0b",
  "3b0ac06",
  "7e4c1e5",
];

const session = await openEmcp("neo-pulse-services-one-grid");
let id = 2;
const moved = [];
for (let i = 0; i < BOXES.length; i++) {
  const res = await callTool(
    session,
    "emcp-tools-move-element",
    { post_id: POST_ID, element_id: BOXES[i], target_parent_id: GRID, position: i },
    id++,
  );
  moved.push({ id: BOXES[i], ok: res.data });
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

const after = await callTool(
  session,
  "emcp-tools-get-page-structure",
  { post_id: POST_ID, max_depth: 6 },
  id++,
);
const tree = JSON.stringify(after.data);
const gridAt = tree.indexOf('"id": "aeb7d82"');
const gridSlice = gridAt >= 0 ? tree.slice(gridAt, gridAt + 2200) : "";

process.stdout.write(
  `${JSON.stringify(
    {
      moved,
      removed,
      stillHasWrappers: WRAPPERS.some((w) => tree.includes(`"id": "${w}"`)),
      boxCount: BOXES.filter((b) => tree.includes(`"id": "${b}"`)).length,
      gridSlice,
    },
    null,
    2,
  )}\n`,
);
