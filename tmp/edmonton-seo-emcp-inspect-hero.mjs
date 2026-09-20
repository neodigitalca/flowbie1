/**
 * Inspect /edmonton-seo/ via EMCP tools HTTP (Basic, no OAuth).
 */
import { readFileSync } from "node:fs";

const POST_ID = 10203;
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
  const text = await res.text();
  return {
    status: res.status,
    session: res.headers.get("mcp-session-id") || session || "",
    parsed: parseRpc(text),
    rawHead: text.slice(0, 400),
  };
}

async function callTool(session, name, args, id) {
  const res = await rpc("tools/call", { name, arguments: args }, id, session);
  return {
    name,
    status: res.status,
    error: res.parsed?.error || null,
    keys: res.parsed ? Object.keys(res.parsed) : [],
    data: toolPayload(res.parsed),
    rawHead: res.rawHead,
    session: res.session,
  };
}

const init = await rpc(
  "initialize",
  {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "neo-pulse-edmonton-seo-inspect", version: "1" },
  },
  1,
);
const session = init.session;
await rpc("notifications/initialized", {}, undefined, session);

const searches = [
  "Edmonton SEO facts",
  "Edmonton SEO built for local search",
  "typical retainers",
  "4,066",
];
const out = { initStatus: init.status, searches: [] };
for (const [i, search_text] of searches.entries()) {
  const found = await callTool(session, "emcp-tools-find-element", { post_id: POST_ID, search_text }, 10 + i);
  out.searches.push({
    search_text,
    status: found.status,
    error: found.error,
    dataType: typeof found.data,
    dataKeys: found.data && typeof found.data === "object" ? Object.keys(found.data) : [],
    data: found.data,
    rawHead: found.rawHead,
  });
}

const html = await callTool(
  session,
  "emcp-tools-get-page-html",
  { url: "https://neodigital.ca/edmonton-seo/", max_bytes: 200000 },
  20,
);
const pageHtml = typeof html.data?.html === "string" ? html.data.html : typeof html.data?.text === "string" ? html.data.text : "";
out.html = {
  status: html.status,
  error: html.error,
  dataKeys: html.data && typeof html.data === "object" ? Object.keys(html.data) : [],
  htmlLen: pageHtml.length,
  hasFacts: pageHtml.includes("Edmonton SEO facts"),
  hasTitle: pageHtml.includes("Edmonton SEO built for local search"),
  hasRetainers: pageHtml.includes("typical retainers"),
  snippet: pageHtml.includes("<h1") ? pageHtml.slice(pageHtml.indexOf("<h1"), pageHtml.indexOf("<h1") + 500) : pageHtml.slice(0, 400),
};

process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
