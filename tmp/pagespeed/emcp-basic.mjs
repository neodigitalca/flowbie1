/**
 * Call neodigital EMCP over HTTP Basic (no OAuth).
 */
import { readFileSync } from "node:fs";

const mcp = JSON.parse(readFileSync(new URL("file:///C:/Users/Sean%20Craig/.cursor/mcp.json"), "utf8"));
const server = mcp.mcpServers["emcp-neodigital-ca"];
const url = server.url;

async function rpc(method, params, id, session) {
  const headers = {
    Authorization: server.headers.Authorization,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (session) headers["Mcp-Session-Id"] = session;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const text = await res.text();
  return {
    status: res.status,
    session: res.headers.get("mcp-session-id") || session || "",
    text,
  };
}

const init = await rpc("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "neo-pulse-pagespeed", version: "1" },
}, 1);
console.log("init", init.status, "session", init.session ? "yes" : "no");
const session = init.session;
await rpc("notifications/initialized", {}, undefined, session);

const got = await rpc(
  "tools/call",
  {
    name: "emcp-tools-get-element-settings",
    arguments: { post_id: 55, element_id: "f656ffb" },
  },
  3,
  session
);
console.log("get", got.status, got.text.slice(0, 4000));
