import { createRequire } from "node:module";
import http from "node:http";
import https from "node:https";

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

async function fetchUpstream(url, options, body, redirectsLeft = 5) {
  const response = await upstreamRequest(url, options, body);
  const status = response.status;
  if (redirectsLeft > 0 && status >= 300 && status < 400 && response.headers.location) {
    const nextUrl = new URL(response.headers.location, url).href;
    return fetchUpstream(nextUrl, { ...options, method: "GET", headers: { ...options.headers, host: new URL(nextUrl).host } }, undefined, redirectsLeft - 1);
  }
  return response;
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

      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ?? "";
        const path = rawUrl.split("?")[0] ?? "";
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
          );

          res.statusCode = upstream.status;
          res.setHeader("cache-control", "no-store");

          for (const [key, value] of Object.entries(upstream.headers)) {
            if (value == null) continue;
            const lower = key.toLowerCase();
            if (lower === "transfer-encoding" || lower === "location" || lower === "connection") continue;
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
