import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 163;
const WIDGET_IDS = [
  "87a2060", // logo
  "2d805f8", // social
  "0efac59", // heading
  "789eb33", // quote btn
  "df72339", // quick links heading
  "d27123b", // icon-list 1
  "a6ad2f0", // icon-list 2
  "05c7626", // health canada badge
  "8a6c1a1", // copyright
];

const session = await openEmcp("neo-pulse-footer-widgets-dump");
let id = 2;
const results = {};

for (const wid of WIDGET_IDS) {
  const res = await callTool(
    session,
    "emcp-tools-get-element-settings",
    { post_id: POST_ID, element_id: wid },
    id++,
  );
  results[wid] = res.data?.settings;
}

process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
