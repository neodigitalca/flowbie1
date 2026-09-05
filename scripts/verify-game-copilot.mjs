#!/usr/bin/env node
/**
 * Smoke test Game Copilot API (server must be running, or spawns briefly).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const port = Number(process.env.GAME_COPILOT_PORT || 3847);

function request(method, pathname, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: pathname,
        method,
        headers: data
          ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }
          : {},
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          try {
            resolve({ status: res.statusCode, json: JSON.parse(text) });
          } catch {
            resolve({ status: res.statusCode, text });
          }
        });
      },
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function waitForHealth(maxMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const r = await request("GET", "/api/status");
        if (r.status === 200 && r.json?.ok) return resolve(r.json);
      } catch {
        /* retry */
      }
      if (Date.now() - start > maxMs) return reject(new Error("Server did not become healthy"));
      setTimeout(poll, 500);
    };
    poll();
  });
}

async function main() {
  let child = null;
  let started = false;

  try {
    await request("GET", "/api/status");
  } catch {
    started = true;
    child = spawn("node", [path.join(repoRoot, "apps", "game-copilot", "server.mjs")], {
      cwd: path.join(repoRoot, "apps", "game-copilot"),
      stdio: "ignore",
      detached: false,
    });
    await waitForHealth();
  }

  const status = await request("GET", "/api/status");
  if (status.status !== 200) throw new Error("Status check failed");

  const pngPath = path.join(os.tmpdir(), "game-copilot-smoke.png");
  fs.writeFileSync(
    pngPath,
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    ),
  );

  const ask = await request("POST", "/api/ask", {
    transcript: "what do I do now im stuck",
    mode: "stuck",
    spoilerLevel: "minimal",
  });

  if (ask.status !== 200) {
    throw new Error(`Ask failed: ${ask.status} ${JSON.stringify(ask.json || ask.text)}`);
  }
  if (!ask.json?.answer?.next_steps?.length && !ask.json?.error) {
    console.warn("[verify-game-copilot] Warning: empty next_steps (vision may lack game context)");
  }

  console.log("[verify-game-copilot] OK");
  if (child) {
    child.kill("SIGINT");
  }
}

main().catch((err) => {
  console.error("[verify-game-copilot]", err.message);
  process.exit(1);
});
