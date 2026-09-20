import { writeFileSync } from "node:fs";
import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-about-dump");
const structure = await callTool(
  session,
  "emcp-tools-get-page-structure",
  { post_id: 129, max_depth: 12 },
  2,
);
writeFileSync("tmp/neodigital-about-tree.json", `${JSON.stringify(structure.data, null, 2)}\n`);
process.stdout.write("wrote tmp/neodigital-about-tree.json\n");
