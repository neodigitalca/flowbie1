/**
 * Locate leftover facts string in EMCP page HTML chunk.
 */
import { readFileSync } from "node:fs";

const mcp = JSON.parse(readFileSync("C:/Users/Sean Craig/.cursor/mcp.json", "utf8"));
const server = mcp.mcpServers["emcp-neodigital-ca"];

function parseRpc(text) {
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

function toolPayload(rpc) {
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

async function rpc(method, params, id, session) {
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

const init = await rpc(
  "initialize",
  {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "neo-pulse-edmonton-seo-facts-html", version: "1" },
  },
  1,
);
const session = init.session;
await rpc("notifications/initialized", {}, undefined, session);
const res = await rpc(
  "tools/call",
  {
    name: "emcp-tools-get-page-html",
    arguments: { url: "https://neodigital.ca/edmonton-seo/?nonitro=1", max_bytes: 200000 },
  },
  2,
  session,
);
const data = toolPayload(res.parsed);
const chunk = data?.chunk && typeof data.chunk === "object" ? data.chunk : {};
const html = typeof chunk.html === "string"
  ? chunk.html
  : typeof chunk.body === "string"
    ? chunk.body
    : JSON.stringify(data);
const idx = html.indexOf("Edmonton SEO facts");
const headingIdx = html.indexOf("elementor-element-2bbef65");
process.stdout.write(
  `${JSON.stringify(
    {
      chunkKeys: Object.keys(chunk),
      htmlLen: html.length,
      factsAt: idx,
      factsContext: idx >= 0 ? html.slice(Math.max(0, idx - 120), idx + 220) : "",
      headingAt: headingIdx,
      headingContext: headingIdx >= 0 ? html.slice(headingIdx, headingIdx + 500) : "",
    },
    null,
    2,
  )}\n`,
);
