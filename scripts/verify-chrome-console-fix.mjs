#!/usr/bin/env node
/**
 * Verify dev modules load without duplicate-binding / missing-export errors.
 * Does not open or focus Chrome.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createConnection } from "node:net";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const auditTxt = join(root, ".cursor-chrome-audit", "console-audit.txt");

const DEV_PORTS = [8080, 3000, 5173];
const MODULES = [
  "/src/lib/gsc-reporting/gsc-reporting-pipeline.ts",
  "/src/lib/gsc-reporting/gsc-reporting-progress-log.ts",
  "/src/lib/workflow/workflow-bound-automation-runner.ts",
  "/src/lib/agent-runs/executor.ts",
  "/src/main.tsx",
];

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

async function findDevServer() {
  for (const port of DEV_PORTS) {
    if (await portOpen("127.0.0.1", port)) return port;
  }
  return null;
}

async function main() {
  const port = await findDevServer();
  if (!port) {
    console.error("verify-chrome-console-fix: no dev server on 8080/3000/5173");
    process.exit(1);
  }

  const failures = [];
  for (const path of MODULES) {
    const url = `http://127.0.0.1:${port}${path}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const body = await res.text();
    if (!res.ok) {
      failures.push(`${path}: HTTP ${res.status}`);
      continue;
    }
    if (/has already been declared|is not defined|SyntaxError/i.test(body)) {
      failures.push(`${path}: transform contains error marker`);
    }
    if (path.includes("gsc-reporting-pipeline")) {
      const namedImports = body.match(/import[^\n]*formatGscSectionCompleteLabel/g) ?? [];
      const namespaceImport = /import\s+\*\s+as\s+\w+\s+from\s+[^\n]*gsc-reporting-progress-log/.test(
        body,
      );
      if (namedImports.length > 0) {
        failures.push(
          `${path}: expected namespace progress-log import only, found named formatGscSectionCompleteLabel import(s): ${namedImports.length}`,
        );
      }
      if (!namespaceImport) {
        failures.push(`${path}: missing namespace import of gsc-reporting-progress-log`);
      }
    }
  }

  if (existsSync(auditTxt)) {
    const audit = readFileSync(auditTxt, "utf8");
    if (audit.includes("duplicate-import") && audit.includes("formatGscSectionCompleteLabel")) {
      failures.push("static audit still reports duplicate formatGscSectionCompleteLabel import");
    }
    if (audit.includes("duplicate-import") && audit.includes("resolveAgentRunRecipeKey")) {
      failures.push("static audit still reports duplicate resolveAgentRunRecipeKey import");
    }
  }

  if (failures.length > 0) {
    console.error("verify-chrome-console-fix FAILED:");
    for (const line of failures) console.error(`  - ${line}`);
    process.exit(1);
  }

  console.log(`verify-chrome-console-fix OK (dev server :${port})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
