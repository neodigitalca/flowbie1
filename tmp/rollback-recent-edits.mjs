import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-rollback-recent");
const ids = ["8869a62c2905", "7c4ca9bdcc23", "ab865c95e268", "a312f1a13160"];
let seq = 1;

for (const id of ids) {
  const res = await callTool(session, "emcp-tools-rollback-change", { id, force: true }, seq++);
  console.log(`Rollback ${id}:`, JSON.stringify(res.data || res, null, 2).slice(0, 500));
}
