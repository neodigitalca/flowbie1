import { createRequire } from "node:module";
import http from "node:http";
import https from "node:https";
import {
  handleDataForSeoLlmResponsesLive,
  isLlmResponsesLiveRequest,
  loadDataForSeoAuth,
} from "./dataforseo-llm-responses-direct.mjs";

const require = createRequire(import.meta.url);
const { resolveDevApiTarget, isLocalWpProxyTarget } = require("./resolve-dev-api-target.cjs");

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function upstreamRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port,
        path: `${parsed.pathname}${parsed.search}`,
        method: options.method,
        headers: options.headers,
        rejectUnauthorized: parsed.protocol === "https:" ? false : undefined,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 502,
            headers: res.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );
    req.on("error", reject);
    if (body?.length) req.write(body);
    req.end();
  });
}

async function fetchUpstream(url, options, body, targetOrigin, redirectsLeft = 5) {
  const response = await upstreamRequest(url, options, body);
  const status = response.status;
  if (redirectsLeft <= 0 || status < 300 || status >= 400) {
    return response;
  }

  const locationRaw = response.headers.location;
  if (!locationRaw) {
    return response;
  }

  const nextUrl = new URL(Array.isArray(locationRaw) ? locationRaw[0] : locationRaw, url);
  const targetHost = new URL(targetOrigin).host;
  if (nextUrl.host !== targetHost) {
    return response;
  }

  const nextOrigin = `${nextUrl.protocol}//${nextUrl.host}`;
  const nextHeaders = { ...options.headers, host: nextUrl.host };
  return fetchUpstream(
    nextUrl.href,
    { ...options, method: "GET", headers: nextHeaders },
    undefined,
    nextOrigin,
    redirectsLeft - 1,
  );
}

/**
 * Proxy /api to local WP without exposing cross-origin redirects to the browser.
 */
export function localWpApiProxyPlugin() {
  return {
    name: "local-wp-api-proxy",
    enforce: "pre",
    configureServer(server) {
      const target = resolveDevApiTarget();
      if (!isLocalWpProxyTarget(target)) return;

      const targetOrigin = new URL(target).origin;
      const dfsAuth = loadDataForSeoAuth();

      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ?? "";
        const path = rawUrl.split("?")[0] ?? "";

        if (isLlmResponsesLiveRequest(req.method, path)) {
          if (!dfsAuth) {
            res.statusCode = 502;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: "DATAFORSEO_API_LOGIN / DATAFORSEO_API_PASSWORD missing in .env" }));
            return;
          }
          try {
            const body = req.method && !["GET", "HEAD"].includes(req.method) ? await readRequestBody(req) : undefined;
            const result = await handleDataForSeoLlmResponsesLive(body, dfsAuth);
            res.statusCode = result.status;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(JSON.stringify(result.json));
          } catch (error) {
            res.statusCode = 502;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(
              JSON.stringify({
                error: error instanceof Error ? error.message : "DataForSEO LLM request failed",
              }),
            );
          }
          return;
        }

        if (!path.startsWith("/api")) {
          next();
          return;
        }

        try {
          const body =
            req.method && !["GET", "HEAD"].includes(req.method) ? await readRequestBody(req) : undefined;

          const headers = {};
          for (const [key, value] of Object.entries(req.headers)) {
            if (value == null || key === "host" || key === "connection") continue;
            headers[key] = Array.isArray(value) ? value.join(", ") : value;
          }
          headers.host = new URL(targetOrigin).host;

          const upstream = await fetchUpstream(
            `${targetOrigin}${rawUrl}`,
            { method: req.method, headers },
            body?.length ? body : undefined,
            targetOrigin,
          );

          if (upstream.status === 504) {
            res.statusCode = 200;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.setHeader("cache-control", "no-store");
            res.end(
              JSON.stringify({
                ok: false,
                success: false,
                error: "WordPress timed out",
                workflows: [],
                runs: [],
                tasks: [],
                rows: [],
              }),
            );
            return;
          }

          if (upstream.status >= 300 && upstream.status < 400) {
            res.statusCode = 502;
            res.setHeader("content-type", "application/json; charset=utf-8");
            res.end(
              JSON.stringify({
                ok: false,
                error: "Local API proxy blocked an upstream redirect. Retry with a trailing slash on the API path.",
              }),
            );
            return;
          }

          res.statusCode = upstream.status;
          res.setHeader("cache-control", "no-store");

          for (const [key, value] of Object.entries(upstream.headers)) {
            if (value == null) continue;
            const lower = key.toLowerCase();
            if (lower === "transfer-encoding" || lower === "connection") continue;
            if (lower === "location") continue;
            if (lower === "set-cookie") {
              const cookies = Array.isArray(value) ? value : [value];
              for (const cookie of cookies) {
                res.appendHeader(
                  key,
                  cookie.replace(/;\s*Domain=[^;]+/gi, "; Domain=localhost").replace(/;\s*Secure/gi, ""),
                );
              }
              continue;
            }
            res.setHeader(key, value);
          }

          res.end(upstream.body);
        } catch (error) {
          res.statusCode = 502;
          res.setHeader("content-type", "application/json; charset=utf-8");
          res.end(
            JSON.stringify({
              ok: false,
              error: error instanceof Error ? error.message : "Local API proxy failed",
            }),
          );
        }
      });
    },
  };
}
