/**
 * Verify live /edmonton-seo/ H1 via EMCP get-page-html.
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

async function callTool(session, name, args, id) {
  const res = await rpc("tools/call", { name, arguments: args }, id, session);
  if (res.status !== 200) throw new Error(`${name} HTTP ${res.status}`);
  if (res.parsed?.error) throw new Error(`${name} ${JSON.stringify(res.parsed.error)}`);
  return toolPayload(res.parsed);
}

const init = await rpc(
  "initialize",
  {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "neo-pulse-edmonton-seo-verify", version: "1" },
  },
  1,
);
const session = init.session;
await rpc("notifications/initialized", {}, undefined, session);

const heading = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: 10203, element_id: "2bbef65" },
  2,
);
const html = await callTool(
  session,
  "emcp-tools-get-page-html",
  { url: "https://neodigital.ca/edmonton-seo/?nonitro=1", max_bytes: 200000 },
  3,
);

const blob = JSON.stringify(html);
const h1At = blob.search(/<h1[\s>]/i);
process.stdout.write(
  `${JSON.stringify(
    {
      headingTitle: heading?.settings?.title ?? heading?.title ?? null,
      htmlKeys: html && typeof html === "object" ? Object.keys(html) : [],
      chunkType: typeof html?.chunk,
      responseType: typeof html?.response,
      target: html?.target || null,
      render_mode: html?.render_mode || null,
      hasFacts: blob.includes("Edmonton SEO facts"),
      hasShortTitle: blob.includes("Edmonton SEO built for local search."),
      h1Snippet: h1At >= 0 ? blob.slice(h1At, h1At + 400) : "",
    },
    null,
    2,
  )}\n`,
);
