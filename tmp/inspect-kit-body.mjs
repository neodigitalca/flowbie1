import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-inspect-kit-body");
const res = await callTool(session, "emcp-tools-get-global-settings", {}, 1);
const s = res.data?.settings || res.data || {};

const bodyKeys = {};
for (const [k, v] of Object.entries(s)) {
  if (k.startsWith("body_") || k === "custom_css") {
    bodyKeys[k] = v;
  }
}
console.log("KIT BODY SETTINGS:", JSON.stringify(bodyKeys, null, 2));
