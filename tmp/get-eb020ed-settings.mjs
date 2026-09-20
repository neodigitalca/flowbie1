import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-eb020ed");
const r = await callTool(session, "emcp-tools-get-element-settings", { post_id: 10203, element_id: "eb020ed" }, 1);
const s = r.data?.settings || {};
const keys = Object.keys(s).filter((k) => k.includes("transform") || k.includes("width") || k.includes("size"));
console.log(JSON.stringify(Object.fromEntries(keys.map((k) => [k, s[k]])), null, 2));
