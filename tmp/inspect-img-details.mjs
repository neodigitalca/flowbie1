import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-inspect-img-20277c5");
const img = await callTool(session, "emcp-tools-get-element-settings", { post_id: 10203, element_id: "20277c5" }, 1);
console.log("IMG SETTINGS:", JSON.stringify(img.data?.settings, null, 2));

const media = await callTool(session, "emcp-tools-get-media", { id: 10224 }, 2);
console.log("MEDIA DETAILS:", JSON.stringify(media.data, null, 2));
