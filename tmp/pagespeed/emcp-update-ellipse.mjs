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
  const body = { jsonrpc: "2.0", method, params };
  if (id !== undefined) body.id = id;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  return { status: res.status, session: res.headers.get("mcp-session-id") || session || "", text: await res.text() };
}

const init = await rpc("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "neo-pulse-pagespeed", version: "1" },
}, 1);
const session = init.session;
await rpc("notifications/initialized", {}, undefined, session);

const updated = await rpc(
  "tools/call",
  {
    name: "emcp-tools-update-element",
    arguments: {
      post_id: 55,
      element_id: "f656ffb",
      settings: {
        image_size: "large",
        width: { size: 42, unit: "%" },
        width_mobile: { size: 220, unit: "px" },
        width_tablet: { size: 280, unit: "px" },
        _css_classes: "np-hero-ellipse",
      },
    },
  },
  4,
  session
);
console.log("update", updated.status, updated.text.slice(0, 1500));
