import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 129;

const MOVES = [
  { id: "be7799c", parent: "5c4f099", pos: 0 },
  { id: "997322a", parent: "6e9d357", pos: 0 },
  { id: "ac794fe", parent: "6e9d357", pos: 1 },
  { id: "1a86cef", parent: "94135cd", pos: 0 },
  { id: "8fc1bc5", parent: "94135cd", pos: 1 },
  { id: "88af5fb", parent: "94135cd", pos: 2 },
  { id: "4f16f2c", parent: "750d915", pos: 0 },
  { id: "e40513e", parent: "750d915", pos: 1 },
  { id: "9080211", parent: "750d915", pos: 2 },
  { id: "f60c654", parent: "f38b8d3", pos: 0 },
  { id: "63717e8", parent: "f38b8d3", pos: 1 },
  { id: "695511b", parent: "f38b8d3", pos: 2 },
  { id: "8c5a974", parent: "2cf7772", pos: 0 },
  { id: "debf054", parent: "2cf7772", pos: 1 },
  { id: "ceb06eb", parent: "2cf7772", pos: 2 },
  { id: "33132e1", parent: "b0adc17", pos: 0 },
  { id: "500ef9a", parent: "b0adc17", pos: 1 },
  { id: "38cb67c", parent: "b0adc17", pos: 2 },
  { id: "2dddd65", parent: "2048daa", pos: 0 },
  { id: "86db9e8", parent: "2048daa", pos: 1 },
  { id: "5ca5130", parent: "38cc5e1", pos: 0 },
  { id: "3d2abb0", parent: "38cc5e1", pos: 1 },
  { id: "63127fd", parent: "f6cd5cc", pos: 0 },
  { id: "32c02ad", parent: "f6cd5cc", pos: 1 },
  { id: "bd1038c", parent: "8497e8d", pos: 0 },
];

const REMOVES = [
  "d791f88",
  "9e459fa",
  "4c55bee",
  "894ebe5",
  "d0c3c85",
  "5a0d257",
  "5eca709",
  "a495a8c",
  "d59d4d0",
  "20d6ce6",
  "f1d056d",
  "d288168",
  "b75f76a",
  "a557b29",
  "e1e70dc",
  "91f1317",
  "5e55645",
];

const session = await openEmcp("neo-pulse-about-flatten");
let id = 2;
const moved = [];
for (const item of MOVES) {
  const res = await callTool(
    session,
    "emcp-tools-move-element",
    {
      post_id: POST_ID,
      element_id: item.id,
      target_parent_id: item.parent,
      position: item.pos,
    },
    id++,
  );
  moved.push({ id: item.id, ok: res.data?.success === true });
}

const removed = [];
for (const element_id of REMOVES) {
  const res = await callTool(
    session,
    "emcp-tools-remove-element",
    { post_id: POST_ID, element_id },
    id++,
  );
  removed.push({ id: element_id, ok: res.data?.success === true });
}

const after = await callTool(
  session,
  "emcp-tools-get-page-structure",
  { post_id: POST_ID, max_depth: 8 },
  id++,
);
const blob = JSON.stringify(after.data);
const leftover = REMOVES.filter((w) => blob.includes(`"${w}"`));
const keep = [
  "be7799c",
  "997322a",
  "ac794fe",
  "1a86cef",
  "8fc1bc5",
  "5e59a87",
  "4056684",
  "da15b38",
  "2dddd65",
].filter((w) => blob.includes(`"${w}"`));

process.stdout.write(
  `${JSON.stringify(
    {
      movedOk: moved.filter((m) => m.ok).length,
      movedFail: moved.filter((m) => !m.ok),
      removedOk: removed.filter((m) => m.ok).length,
      removedFail: removed.filter((m) => !m.ok),
      leftover,
      keepCount: keep.length,
    },
    null,
    2,
  )}\n`,
);
