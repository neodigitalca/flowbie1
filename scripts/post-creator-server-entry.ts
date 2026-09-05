#!/usr/bin/env node
/**
 * Entry point for post creator server worker jobs (runs TS generator harness).
 */
function ensureViteEnvShim(): void {
  if (typeof import.meta === "undefined") return;
  const meta = import.meta as ImportMeta & { env?: Record<string, string | boolean> };
  if (meta.env) return;
  meta.env = {
    DEV: false,
    PROD: true,
    MODE: "production",
    VITE_BASE_PATH: "",
    VITE_BACKEND_API_BASE: process.env.VITE_BACKEND_API_BASE?.trim() ?? "",
    VITE_MCP_API_BASE: "",
    VITE_NEO_PULSE: "",
    VITE_OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY?.trim() ?? "",
  };
}

const raw = process.env.JOB_PAYLOAD?.trim() ?? "";
if (!raw) {
  console.error("[post-creator-server] Missing JOB_PAYLOAD");
  process.exit(1);
}

let payload: import("../src/lib/post-creator/post-creator-server-harness.ts").PostCreatorServerJobPayload;
try {
  payload = JSON.parse(raw);
} catch {
  console.error("[post-creator-server] Invalid JOB_PAYLOAD JSON");
  process.exit(1);
}

const apiBase = typeof payload.apiBase === "string" ? payload.apiBase.trim() : "";
if (apiBase) {
  process.env.VITE_BACKEND_API_BASE = apiBase;
  try {
    if (/\.local$/i.test(new URL(apiBase).hostname)) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }
  } catch {
    // ignore invalid apiBase for TLS shim
  }
}

ensureViteEnvShim();
if (apiBase && typeof import.meta !== "undefined") {
  const meta = import.meta as ImportMeta & { env?: Record<string, string | boolean> };
  if (meta.env) {
    meta.env.VITE_BACKEND_API_BASE = apiBase;
  }
}

const { runPostCreatorServerJob } = await import("../src/lib/post-creator/post-creator-server-harness.ts");

runPostCreatorServerJob(payload)
  .then((result) => {
    if (!result.ok) {
      console.error("[post-creator-server]", result.error ?? "failed");
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error("[post-creator-server]", err instanceof Error ? err.message : err);
    process.exit(1);
  });
