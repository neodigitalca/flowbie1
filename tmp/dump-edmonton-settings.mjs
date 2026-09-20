import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-dump-settings-edmonton");
const POST_ID = 10203;

const ids = [
  "afa170d", "9806fc2", "21b3884", "2bbef65", "4101a06", "e8af43f", "bb9c5ef", "f7d4e39",
  "3553037", "a48b7dc", "8141703", "4b39b50", "ba7052d", "70e79f8", "1939589", "fb92c02", "20277c5", "1819f4b", "a75aad3", "e2ce6fe", "9474c98", "6edfb5a", "f3851d6", "859fe91", "7364af0", "8649bae", "b9a6d06", "bbdcc6b", "76c6b45", "79b72fd"
];

const results = {};
let seq = 2;
for (const id of ids) {
  const res = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: id }, seq++);
  results[id] = res.data?.settings || res.data || {};
}

import fs from "fs";
fs.writeFileSync("tmp/edmonton-seo-elements-settings.json", JSON.stringify(results, null, 2));
console.log("Settings written to tmp/edmonton-seo-elements-settings.json");
