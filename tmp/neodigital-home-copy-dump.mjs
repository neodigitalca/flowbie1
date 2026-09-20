import { callTool, openEmcp } from "./emcp-http.mjs";

const POST_ID = 55;
const session = await openEmcp("neo-pulse-home-copy-dump");
const t40 = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: "2881168" }, 2);
const title40 = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: "6001906" }, 3);
const check40 = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: "4eec2c8" }, 4);

const t3a = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: "503d669" }, 5);
const title3a = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: "06a2f8a" }, 6);
const check3a = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: "d474292" }, 7);

const t78 = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: "8d8f378" }, 8);
const title78 = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: "ff84b65" }, 9);
const check78 = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: "f6cdb41" }, 10);

process.stdout.write(
  `${JSON.stringify(
    {
      sec40: {
        title: title40.data?.settings,
        copy: t40.data?.settings?.editor,
        check: check40.data?.settings?.check_list,
      },
      sec3a: {
        title: title3a.data?.settings,
        copy: t3a.data?.settings?.editor,
        check: check3a.data?.settings?.check_list,
      },
      sec78: {
        title: title78.data?.settings,
        copy: t78.data?.settings?.editor,
        check: check78.data?.settings?.check_list,
      },
    },
    null,
    2,
  )}\n`,
);
