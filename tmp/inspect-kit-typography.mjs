import { callTool, openEmcp } from "./emcp-http.mjs";

const session = await openEmcp("neo-pulse-inspect-global-settings");
const res = await callTool(session, "emcp-tools-get-global-settings", {}, 1);

const settings = res.data?.settings || res.data || {};
console.log("GLOBAL SETTINGS KEYS:", Object.keys(settings));

// Inspect typography tokens
console.log("SYSTEM TYPOGRAPHY:", JSON.stringify(settings.system_typography, null, 2));
console.log("CUSTOM TYPOGRAPHY:", JSON.stringify(settings.custom_typography, null, 2));
