import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-kit-globals");
const kit = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: 5564 },
  2,
);
const s = kit.data?.settings || {};
process.stdout.write(
  `${JSON.stringify(
    {
      custom_typography: s.custom_typography,
      system_typography: s.system_typography,
      custom_colors: s.custom_colors,
      system_colors: s.system_colors,
    },
    null,
    2,
  )}\n`,
);
