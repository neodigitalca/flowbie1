import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-stats-globals");
const settings = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: 55, element_id: "c8e2940" },
  2,
);
process.stdout.write(
  `${JSON.stringify(settings.data?.settings?.__globals__ || settings.data?.__globals__ || {}, null, 2)}\n`,
);
