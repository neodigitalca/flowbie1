import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-check-live-sec355");
const POST_ID = 10203;

const struct = await callTool(session, "emcp-tools-get-page-structure", { post_id: POST_ID, max_depth: 6 }, 1);
const sec355 = struct.data?.structure?.find(s => s.id === "3553037");
console.log("CURRENT SEC 355 STRUCTURE:");
console.log(JSON.stringify(sec355, null, 2));

const fb92 = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: "fb92c02" }, 2);
console.log("FB92C02 SETTINGS:", JSON.stringify(fb92.data?.settings, null, 2));

const e2ce = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: "e2ce6fe" }, 3);
console.log("E2CE6FE SETTINGS:", JSON.stringify(e2ce.data?.settings, null, 2));

const c947 = await callTool(session, "emcp-tools-get-element-settings", { post_id: POST_ID, element_id: "9474c98" }, 4);
console.log("9474C98 SETTINGS:", JSON.stringify(c947.data?.settings, null, 2));
