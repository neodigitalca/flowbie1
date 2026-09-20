import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-kit-keys");
const kit = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: 5564 },
  2,
);
process.stdout.write(
  `${JSON.stringify(Object.keys(kit.data?.settings || {}), null, 2)}\n`,
);
