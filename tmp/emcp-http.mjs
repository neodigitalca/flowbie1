import { readFileSync } from "node:fs";

const mcp = JSON.parse(readFileSync("C:/Users/Sean Craig/.cursor/mcp.json", "utf8"));
const server = mcp.mcpServers["emcp-neodigital-ca"];
if (!server?.url || !server.headers?.Authorization?.startsWith("Basic ")) {
  throw new Error("emcp-neodigital-ca must use HTTP Basic");
}

export function parseRpc(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const lines = trimmed.split("\n");
  let last = null;
  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    last = JSON.parse(payload);
  }
  return last;
}

export function toolPayload(rpc) {
  const content = rpc?.result?.content;
  if (!Array.isArray(content)) return rpc?.result ?? rpc;
  const texts = content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text);
  if (!texts.length) return rpc?.result ?? rpc;
  try {
    return JSON.parse(texts.join("\n"));
  } catch {
    return { text: texts.join("\n") };
  }
}

export async function rpc(method, params, id, session) {
  const headers = {
    Authorization: server.headers.Authorization,
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (session) headers["Mcp-Session-Id"] = session;
  const body = { jsonrpc: "2.0", method, params };
  if (id !== undefined) body.id = id;
  const res = await fetch(server.url, { method: "POST", headers, body: JSON.stringify(body) });
  return {
    status: res.status,
    session: res.headers.get("mcp-session-id") || session || "",
    parsed: parseRpc(await res.text()),
  };
}

export async function openEmcp(clientName) {
  const init = await rpc(
    "initialize",
    {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: clientName, version: "1" },
    },
    1,
  );
  if (init.status !== 200) throw new Error(`initialize HTTP ${init.status}`);
  await rpc("notifications/initialized", {}, undefined, init.session);
  return init.session;
}

export async function callTool(session, name, args, id) {
  const res = await rpc("tools/call", { name, arguments: args }, id, session);
  if (res.status !== 200) throw new Error(`${name} HTTP ${res.status}`);
  if (res.parsed?.error) throw new Error(`${name} ${JSON.stringify(res.parsed.error)}`);
  return { session: res.session, data: toolPayload(res.parsed) };
}
