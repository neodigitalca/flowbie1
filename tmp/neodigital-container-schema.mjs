import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-add-container-schema");
const schema = await callTool(
  session,
  "emcp-tools-get-container-schema",
  {},
  2,
);
process.stdout.write(`${JSON.stringify({ schema: schema.data }, null, 2)}\n`);
