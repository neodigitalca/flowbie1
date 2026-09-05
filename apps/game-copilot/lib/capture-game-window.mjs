import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_SCRIPT = path.join(__dirname, "capture-worker.ps1");

/** @type {import('node:child_process').ChildProcessWithoutNullStreams | null} */
let workerProc = null;
/** @type {readline.Interface | null} */
let workerRl = null;
let workerReady = false;
/** @type {Array<{ job: object; resolve: Function; reject: Function }>} */
const queue = [];
let busy = false;

function spawnWorker() {
  if (workerProc) return;
  workerProc = spawn(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Sta", "-File", WORKER_SCRIPT, "-Worker"],
    { stdio: ["pipe", "pipe", "pipe"], windowsHide: true },
  );
  workerRl = readline.createInterface({ input: workerProc.stdout });
  workerProc.stderr.on("data", (chunk) => {
    const msg = chunk.toString().trim();
    if (msg) console.warn("[game-copilot capture]", msg);
  });
  workerProc.on("exit", () => {
    workerProc = null;
    workerRl = null;
    workerReady = false;
    busy = false;
    while (queue.length) {
      queue.shift()?.reject(new Error("Capture worker exited"));
    }
    setTimeout(spawnWorker, 500);
  });

  workerRl.once("line", (line) => {
    if (line.trim() === "READY") {
      workerReady = true;
      drainQueue();
    }
  });
}

function drainQueue() {
  if (!workerReady || busy || !workerProc || queue.length === 0) return;
  busy = true;
  const job = queue.shift();
  workerRl.once("line", (line) => {
    busy = false;
    try {
      const payload = JSON.parse(line);
      if (!payload.ok) {
        job.reject(new Error(payload.error || "Capture failed"));
      } else {
        job.resolve(payload.meta);
      }
    } catch (err) {
      job.reject(err);
    }
    drainQueue();
  });
  const line = JSON.stringify(job.job);
  workerProc.stdin.write(`${line}\n`);
}

function captureViaWorker(outPath, processName) {
  spawnWorker();
  return new Promise((resolve, reject) => {
    queue.push({ job: { outPath, processName: processName || null }, resolve, reject });
    drainQueue();
  });
}

function captureViaSpawn(outPath, processName) {
  const args = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Sta",
    "-File",
    WORKER_SCRIPT,
    "-OutPath",
    outPath,
  ];
  if (processName) args.push("-ProcessName", processName);
  const result = spawnSync("powershell", args, {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr?.trim() || result.stdout?.trim() || "Capture failed");
  }
  const lines = (result.stdout || "").trim().split(/\r?\n/);
  return JSON.parse(lines[lines.length - 1]);
}

export function shutdownCaptureWorker() {
  if (workerProc?.stdin?.writable) {
    try {
      workerProc.stdin.write("EXIT\n");
    } catch {
      /* ignore */
    }
  }
}

export async function captureForegroundWindowToFile(outPath, options = {}) {
  const processName = options.processName || null;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  let meta;
  try {
    meta = await captureViaWorker(outPath, processName);
  } catch {
    meta = captureViaSpawn(outPath, processName);
  }
  if (!fs.existsSync(outPath)) throw new Error("Capture PNG missing");
  return {
    windowTitle: meta.title || "",
    processName: meta.processName || "",
    pid: meta.pid || 0,
    width: meta.width || 0,
    height: meta.height || 0,
    filePath: outPath,
  };
}

export function readPngBase64(filePath) {
  return fs.readFileSync(filePath).toString("base64");
}

export async function getForegroundWindowInfo() {
  const tmp = path.join(os.tmpdir(), `game-copilot-info-${Date.now()}.png`);
  try {
    const meta = await captureForegroundWindowToFile(tmp);
    return {
      windowTitle: meta.windowTitle || "",
      processName: meta.processName || "",
      pid: meta.pid || 0,
    };
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

spawnWorker();
