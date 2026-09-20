/**
 * Restore /edmonton-seo/ H1 via EMCP update-element (Basic, no OAuth, no PHP).
 */
import { readFileSync } from "node:fs";

const POST_ID = 10203;
const ELEMENT_ID = "2bbef65";
const TITLE = "Edmonton SEO built for local search.";
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
  return { session: res.session, data: toolPayload(res.parsed) };
}

const init = await rpc(
  "initialize",
  {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "neo-pulse-edmonton-seo-hero", version: "1" },
  },
  1,
);
const session = init.session;
await rpc("notifications/initialized", {}, undefined, session);

const before = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: POST_ID, element_id: ELEMENT_ID },
  2,
);
const beforeTitle = before.data?.settings?.title ?? before.data?.title ?? "";

const updated = await callTool(
  session,
  "emcp-tools-update-element",
  { post_id: POST_ID, element_id: ELEMENT_ID, settings: { title: TITLE } },
  3,
);

const after = await callTool(
  session,
  "emcp-tools-get-element-settings",
  { post_id: POST_ID, element_id: ELEMENT_ID },
  4,
);
const afterTitle = after.data?.settings?.title ?? after.data?.title ?? "";

const found = await callTool(
  session,
  "emcp-tools-find-element",
  { post_id: POST_ID, search_text: "Edmonton SEO facts (September 2026)" },
  5,
);
const headingStillHasFacts = (found.data?.matches || []).some(
  (row) => row.element_id === ELEMENT_ID && String(row.settings_preview?.title || "").includes("Edmonton SEO facts"),
);

const html = await callTool(
  session,
  "emcp-tools-get-page-html",
  { url: "https://neodigital.ca/edmonton-seo/", max_bytes: 200000 },
  6,
);
const pageHtml = typeof html.data?.chunk === "string"
  ? html.data.chunk
  : typeof html.data?.response === "string"
    ? html.data.response
    : "";

process.stdout.write(
  `${JSON.stringify(
    {
      ok: afterTitle === TITLE && !headingStillHasFacts,
      beforeLen: String(beforeTitle).length,
      afterTitle,
      update: updated.data,
      headingStillHasFacts,
      leftoverFactWidgets: (found.data?.matches || []).map((row) => ({
        id: row.element_id,
        type: row.widgetType,
      })),
      htmlHasFactsInH1: /<h1[^>]*>[\s\S]*Edmonton SEO facts/i.test(pageHtml),
      htmlHasShortTitle: pageHtml.includes(TITLE),
    },
    null,
    2,
  )}\n`,
);
