import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 163;
const session = await openEmcp("neo-pulse-footer-settings");
const r1 = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: "47b9932" }, 2);
const r2 = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: "56cfa90" }, 3);
const r3 = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: "780eb96" }, 4);
const d6 = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: "d66250b" }, 5);
const c43 = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: "439d153" }, 6);

process.stdout.write(
  `${JSON.stringify(
    {
      d6: d6.data?.settings,
      c43: c43.data?.settings,
      r1: r1.data?.settings,
      r2: r2.data?.settings,
      r3: r3.data?.settings,
    },
    null,
    2,
  )}\n`,
);
