import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-kit-global-settings");
const res = await callTool(
  session,
  "emcp-tools-get-global-settings",
  {},
  2,
);
process.stdout.write(`${JSON.stringify(res.data, null, 2)}\n`);
