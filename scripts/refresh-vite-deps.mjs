#!/usr/bin/env node
/**
 * Clear Vite prebundle cache and restart dev server with --force.
 * Fixes: net::ERR_ABORTED 504 (Outdated Optimize Dep)
 *
 * Windows: no CMD window (windowsHide + direct node/vite spawn, never shell/npx).
 * Does not open or focus the browser.
 */
import { rmSync, existsSync, openSync, appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execSync } from "node:child_process";
import { createConnection } from "node:net";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const viteCache = join(root, "node_modules", ".vite");
const viteBin = join(root, "node_modules", "vite", "bin", "vite.js");
const logPath = join(root, ".local-dev-vite.log");
const statusPath = join(root, ".cursor-chrome-audit", "vite-refresh-status.json");
const isWin = process.platform === "win32";

/** Hide subprocess consoles on Windows. */
const hidden = isWin ? { windowsHide: true } : {};

function portPid(port) {
  try {
    const out = execSync(`netstat -ano | findstr ":${port}"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      ...hidden,
    });
    for (const line of out.split(/\r?\n/)) {
      if (!line.includes("LISTENING")) continue;
      const parts = line.trim().split(/\s+/);
      const pid = Number(parts[parts.length - 1]);
      if (pid > 0) return pid;
    }
  } catch {
    /* no listener */
  }
  return null;
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port }, () => {
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

function killPid(pid) {
  try {
    execSync(`taskkill /PID ${pid} /F`, {
      stdio: "ignore",
      ...hidden,
    });
    return true;
  } catch {
    return false;
  }
}

function spawnHiddenVite(port) {
  if (!existsSync(viteBin)) {
    throw new Error(`Missing ${viteBin}. Run npm install first.`);
  }
  const outFd = openSync(logPath, "a");
  const errFd = openSync(logPath, "a");
  const child = spawn(
    process.execPath,
    [viteBin, "--force", "--host", "0.0.0.0", "--port", String(port)],
    {
      cwd: root,
      detached: true,
      stdio: ["ignore", outFd, errFd],
      env: process.env,
      ...hidden,
    },
  );
  child.unref();
  return child;
}

async function waitForPort(port, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await portOpen(port)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function verifyDep(port, attempts = 30, delayMs = 2000) {
  const url = `http://127.0.0.1:${port}/node_modules/.vite/deps/react-dom_client.js`;
  let lastError = "unknown";
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const body = await res.text();
        if (body.length >= 100) return;
        lastError = "react-dom_client dep response too small";
      } else {
        lastError = `react-dom_client dep HTTP ${res.status}`;
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(lastError);
}

async function main() {
  const port = Number(process.env.VITE_PORT || 8080);
  mkdirSync(dirname(statusPath), { recursive: true });
  writeFileSync(
    statusPath,
    JSON.stringify({ status: "running", port, startedAt: new Date().toISOString() }, null, 2),
  );

  try {
    if (existsSync(viteCache)) {
      rmSync(viteCache, { recursive: true, force: true });
    }

    const existingPid = portPid(port);
    if (existingPid) {
      killPid(existingPid);
      await new Promise((r) => setTimeout(r, 800));
    }

    appendFileSync(logPath, `\n[refresh-vite-deps] ${new Date().toISOString()} restarting vite --force\n`);
    spawnHiddenVite(port);

    const ready = await waitForPort(port);
    if (!ready) {
      throw new Error(`Dev server did not bind :${port} within timeout. See ${logPath}`);
    }

    await verifyDep(port);
    writeFileSync(
      statusPath,
      JSON.stringify(
        { status: "ok", port, finishedAt: new Date().toISOString(), dep: "react-dom_client" },
        null,
        2,
      ),
    );
  } catch (err) {
    writeFileSync(
      statusPath,
      JSON.stringify(
        {
          status: "failed",
          port,
          finishedAt: new Date().toISOString(),
          error: err instanceof Error ? err.message : String(err),
        },
        null,
        2,
      ),
    );
    throw err;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
