#!/usr/bin/env node
import http from "node:http";
import { handleLocalDominatorExportRequest, sendJson } from "./local-dominator-export-jobs.mjs";

const port = Number(process.env.PORT || 10000);

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-LD-Worker-Token");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const pathname = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`).pathname;

  if (pathname === "/health" || pathname === "/") {
    sendJson(res, 200, { ok: true, service: "local-dominator-worker" });
    return;
  }

  const handled = await handleLocalDominatorExportRequest(req, res, pathname);
  if (!handled) {
    sendJson(res, 404, { ok: false, error: "Not found." });
  }
});

server.listen(port, () => {
  console.log(`[local-dominator-worker] listening on :${port}`);
});
