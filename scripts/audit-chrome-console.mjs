#!/usr/bin/env node
/**
 * Capture Chrome console evidence without focusing or launching a browser.
 * Sources (in order):
 * 1) Prior clipboard/console dumps under .cursor/
 * 2) Chrome remote debugging (127.0.0.1:9222+) when enabled
 * 3) Vite-served module transforms on common ports
 * 4) Static duplicate-import scan in src/
 */
import {
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createConnection } from "node:net";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outDir = join(root, ".cursor-chrome-audit");
mkdirSync(outDir, { recursive: true });

const CDP_PORTS = [9222, 9223, 9333];
const DEV_PORTS = [8080, 3000, 5173];
const TARGET_PATHS = [
  "/src/lib/gsc-reporting/gsc-reporting-pipeline.ts",
  "/src/lib/gsc-reporting/gsc-reporting-progress-log.ts",
  "/src/lib/gsc-reporting/gsc-reporting-agent-harness.ts",
  "/src/lib/workflow/workflow-bound-automation-runner.ts",
  "/src/lib/agent-runs/executor.ts",
  "/src/main.tsx",
];

const PRIOR_AUDIT_FILES = [
  join(root, ".cursor", "chrome-console-audit.json"),
  join(root, ".cursor-chrome-console-audit.json"),
];

const log = {
  capturedAt: new Date().toISOString(),
  prior: [],
  cdp: [],
  vite: [],
  static: [],
  summary: [],
  verdict: "unknown",
};

async function portOpen(host, port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port }, () => {
      socket.end();
      resolve(true);
    });
    socket.setTimeout(1500);
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function fetchJson(url, ms = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

function loadPriorAudits() {
  for (const file of PRIOR_AUDIT_FILES) {
    if (!existsSync(file)) continue;
    try {
      const raw = JSON.parse(readFileSync(file, "utf8"));
      const errors = Array.isArray(raw.consoleErrors)
        ? raw.consoleErrors
        : raw.clipboardSnippet
          ? [raw.clipboardSnippet]
          : [];
      log.prior.push({
        file: file.replace(/\\/g, "/").replace(root.replace(/\\/g, "/") + "/", ""),
        capturedAt: raw.capturedAt ?? raw.generatedAt ?? null,
        consoleErrors: errors,
        verdict: raw.verdict ?? null,
      });
    } catch {
      /* ignore malformed */
    }
  }
}

async function captureCdpConsole() {
  for (const port of CDP_PORTS) {
    if (!(await portOpen("127.0.0.1", port))) continue;
    try {
      const tabs = await fetchJson(`http://127.0.0.1:${port}/json`);
      const localTabs = tabs.filter(
        (t) =>
          typeof t.url === "string"
          && (t.url.includes("localhost") || t.url.includes("127.0.0.1")),
      );
      for (const tab of localTabs) {
        if (!tab.webSocketDebuggerUrl) continue;
        const messages = await collectCdpLogs(tab.webSocketDebuggerUrl, 2500);
        log.cdp.push({
          port,
          title: tab.title,
          url: tab.url,
          messages,
        });
      }
      if (log.cdp.length > 0) return;
    } catch {
      /* try next port */
    }
  }
}

function collectCdpLogs(wsUrl, waitMs) {
  return new Promise((resolve) => {
    const messages = [];
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      resolve(messages);
    };

    const ws = new WebSocket(wsUrl);
    const timer = setTimeout(finish, waitMs);

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ id: 1, method: "Runtime.enable" }));
      ws.send(JSON.stringify({ id: 2, method: "Log.enable" }));
    });

    ws.addEventListener("message", (event) => {
      try {
        const payload = JSON.parse(String(event.data));
        if (payload.method === "Runtime.exceptionThrown") {
          const details = payload.params?.exceptionDetails;
          messages.push({
            type: "exception",
            text: details?.exception?.description ?? details?.text ?? "Runtime exception",
            url: details?.url,
            line: details?.lineNumber,
          });
        }
        if (payload.method === "Log.entryAdded") {
          const entry = payload.params?.entry;
          if (entry?.level === "error" || entry?.level === "warning") {
            messages.push({
              type: "log",
              level: entry.level,
              text: entry.text,
              url: entry.url,
              line: entry.lineNumber,
            });
          }
        }
      } catch {
        /* ignore malformed */
      }
    });

    ws.addEventListener("error", finish);
    ws.addEventListener("close", () => {
      clearTimeout(timer);
      finish();
    });
  });
}

async function captureViteErrors() {
  for (const port of DEV_PORTS) {
    if (!(await portOpen("127.0.0.1", port))) continue;
    const base = `http://127.0.0.1:${port}`;
    for (const path of TARGET_PATHS) {
      try {
        const res = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(8000) });
        const body = await res.text();
        const namedImports = (body.match(/^import .*$/gm) ?? []).filter((line) =>
          /formatGscSectionCompleteLabel|resolveAgentRunRecipeKey/.test(line),
        );
        const formatImportCount = (
          body.match(/import[^\n]*formatGscSectionCompleteLabel/g) ?? []
        ).length;
        const namespaceImport = /import\s+\*\s+as\s+\w+\s+from\s+[^\n]*gsc-reporting-progress-log/.test(
          body,
        );
        const row = {
          port,
          path,
          ok: res.ok,
          status: res.status,
          hasSyntaxMarker: /has already been declared|SyntaxError/i.test(body),
          formatGscSectionCompleteLabelImportCount: formatImportCount,
          namespaceProgressLogImport: namespaceImport,
          namedImports,
        };
        if (!res.ok || row.hasSyntaxMarker) {
          row.error = row.hasSyntaxMarker
            ? "Transform output contains SyntaxError / already-declared marker"
            : `HTTP ${res.status}`;
        }
        if (path.includes("gsc-reporting-pipeline") && formatImportCount > 1) {
          row.error = `Duplicate formatGscSectionCompleteLabel import (${formatImportCount})`;
        }
        log.vite.push(row);
      } catch (err) {
        log.vite.push({
          port,
          path,
          error: String(err instanceof Error ? err.message : err),
        });
      }
    }
  }
}

function scanDuplicateImports() {
  function walk(dir, out = []) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) {
        if (name !== "node_modules" && !name.startsWith(".")) walk(p, out);
      } else if (/\.(ts|tsx|mjs)$/.test(name)) {
        out.push(p);
      }
    }
    return out;
  }

  for (const file of walk(join(root, "src"))) {
    const rel = file.replace(/\\/g, "/").replace(root.replace(/\\/g, "/") + "/", "");
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    const bindings = new Map();
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const m = line.match(/^import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+["']([^"']+)["']/);
      if (!m) continue;
      for (const part of m[1].split(",")) {
        const raw = part.trim();
        if (!raw || raw.startsWith("type ")) continue;
        const name = raw.split(/\s+as\s+/).pop().trim();
        if (bindings.has(name)) {
          log.static.push({
            file: rel,
            line: i + 1,
            binding: name,
            firstLine: bindings.get(name),
            kind: "duplicate-import",
          });
        } else {
          bindings.set(name, i + 1);
        }
      }
    }
  }
}

function buildSummary() {
  for (const prior of log.prior) {
    for (const text of prior.consoleErrors ?? []) {
      log.summary.push({ source: "prior-console", text });
    }
  }
  for (const row of log.cdp) {
    for (const msg of row.messages ?? []) {
      log.summary.push({ source: "cdp", ...msg });
    }
  }
  for (const row of log.vite) {
    if (row.error) log.summary.push({ source: "vite", ...row });
  }
  for (const row of log.static) {
    log.summary.push({ source: "static", ...row });
  }

  const viteBroken = log.vite.some((row) => row.error || row.hasSyntaxMarker);
  const staticDupes = log.static.length > 0;
  const liveCdpErrors = log.cdp.some((tab) => (tab.messages ?? []).length > 0);
  const priorOnly =
    log.prior.some((p) => (p.consoleErrors ?? []).length > 0)
    && !viteBroken
    && !staticDupes
    && !liveCdpErrors;

  if (viteBroken || staticDupes || liveCdpErrors) {
    log.verdict = "active-console-risk";
  } else if (priorOnly) {
    log.verdict = "prior-console-stale-source-clean";
  } else {
    log.verdict = "clean";
  }
}

async function main() {
  loadPriorAudits();
  await captureCdpConsole();
  await captureViteErrors();
  scanDuplicateImports();
  buildSummary();

  const jsonPath = join(outDir, "console-audit.json");
  const txtPath = join(outDir, "console-audit.txt");
  writeFileSync(jsonPath, JSON.stringify(log, null, 2));

  const lines = [
    `Chrome console audit @ ${log.capturedAt}`,
    `Verdict: ${log.verdict}`,
    "",
    "=== Summary ===",
    ...log.summary.map((row) => JSON.stringify(row)),
    "",
    "=== Prior console dumps (no focus) ===",
    ...log.prior.flatMap((p) => [
      `${p.file} @ ${p.capturedAt ?? "?"}`,
      ...(p.consoleErrors ?? []).map((e) => `  ${e}`),
    ]),
    "",
    "=== CDP ===",
    log.cdp.length === 0
      ? "(remote debugging not available on 9222/9223/9333; open Chrome was not attached)"
      : "",
    ...log.cdp.flatMap((tab) => [
      `Tab: ${tab.url}`,
      ...(tab.messages ?? []).map((m) => `  [${m.type}] ${m.text}`),
    ]),
    "",
    "=== Vite ===",
    ...log.vite.map((row) => {
      const flag = row.error ? ` ERROR ${row.error}` : " ok";
      return `${row.port}${row.path}:${flag}`;
    }),
    "",
    "=== Static ===",
    log.static.length === 0
      ? "(no duplicate named imports)"
      : log.static
          .map((row) => `${row.file}:${row.line} duplicate ${row.binding} (first ${row.firstLine})`)
          .join("\n"),
  ];
  writeFileSync(txtPath, lines.join("\n"));
  console.log(txtPath);
  console.log(jsonPath);
  console.log(`verdict=${log.verdict}`);
  if (log.verdict === "active-console-risk") process.exitCode = 2;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
