import { callTool, openEmcp } from "./emcp-http.mjs";

const OLD = [
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

const session = await openEmcp("neo-pulse-about-empties");
let id = 2;
const found = [];
for (const element_id of OLD) {
  try {
    const res = await callTool(
      session,
      "emcp-tools-get-element-settings",
      { post_id: 129, element_id },
      id++,
    );
    found.push({ element_id, ok: Boolean(res.data?.element_id || res.data?.settings), data: res.data });
  } catch (e) {
    found.push({ element_id, ok: false, error: String(e).slice(0, 80) });
  }
}

const html = await callTool(
  session,
  "emcp-tools-get-page-html",
  { post_id: 129 },
  id++,
);
const text = JSON.stringify(html.data);
const ids = [...text.matchAll(/data-id=\\"([a-f0-9]{7})\\"/g)].map((m) => m[1]);
const unique = [...new Set(ids)];

process.stdout.write(
  `${JSON.stringify({ oldStillThere: found.filter((f) => f.ok).map((f) => f.element_id), htmlIds: unique }, null, 2)}\n`,
);
