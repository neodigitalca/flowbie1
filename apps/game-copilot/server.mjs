import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";
import { shutdownCaptureWorker } from "./lib/capture-game-window.mjs";
import { loadConfig, loadOpenRouterKey } from "./lib/config.mjs";
import { createContextBuffer } from "./lib/context-buffer.mjs";
import { resolveGameProfile } from "./lib/game-detect.mjs";
import {
  ffmpegAvailable,
  registerPttHotkey,
  startMicRecording,
  stopMicRecording,
} from "./lib/hotkey-ptt.mjs";
import { askCopilot, transcribeAudio } from "./lib/openrouter-copilot.mjs";
import { detectModeFromTranscript } from "./lib/prompts.mjs";
import {
  appendAsk,
  readSession,
  resolveFramePath,
} from "./lib/session-log.mjs";
import {
  addExchange,
  formatExchangesForPrompt,
} from "./lib/session-memory.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uiDir = path.join(__dirname, "ui");
const config = loadConfig();
const apiKey = loadOpenRouterKey();

/** @type {Set<import('ws').WebSocket>} */
const clients = new Set();

let askInFlight = false;
let pttActive = false;

const contextBuffer = createContextBuffer(config, (payload) => {
  broadcast({
    type: "context",
    frames: payload.frames.map((f) => ({
      ...f,
      sessionId: payload.sessionDir ? path.basename(payload.sessionDir) : null,
    })),
    frozen: payload.frozen,
    staleFrameCount: payload.staleFrameCount,
    captureError: payload.captureError || null,
  });
  if (payload.captureError) {
    broadcastStatus(`Capture failed: ${payload.captureError}`, false);
  } else if (payload.frozen) {
    broadcastStatus("Same frame 4+ times — unpause Isaac (Esc) or keep playing", false);
  }
});

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(data);
  }
}

function broadcastStatus(text, listening = false) {
  broadcast({ type: "status", text, listening });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(obj));
}

function serveStatic(req, res) {
  let rel = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const filePath = path.join(uiDir, rel.replace(/^\//, ""));
  if (!filePath.startsWith(uiDir) || !fs.existsSync(filePath)) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }
  const ext = path.extname(filePath);
  const types = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
  };
  res.statusCode = 200;
  res.setHeader("Content-Type", types[ext] || "application/octet-stream");
  fs.createReadStream(filePath).pipe(res);
}

function summarizeAnswer(answer) {
  return (answer.next_steps || []).join(" | ");
}

async function runAsk({ transcript, mode, spoilerLevel, audioPath }) {
  if (askInFlight) throw new Error("Already processing a question");
  askInFlight = true;
  contextBuffer.touchActivity();
  broadcastStatus("Thinking…", false);

  try {
    let text = (transcript || "").trim();
    if (!text && audioPath) {
      broadcastStatus("Transcribing…", false);
      text = await transcribeAudio({
        apiKey,
        model: config.model,
        referer: config.referer,
        appTitle: config.appTitle,
        audioPath,
      });
    }
    if (!text) throw new Error("No question heard or typed");

    const resolvedMode = mode || detectModeFromTranscript(text);
    const fresh = await contextBuffer.captureFreshFrame();
    const buffered = contextBuffer.getBufferedFramePaths();
    const framePaths = [...new Set([...buffered, fresh.path])];

    const profile = resolveGameProfile(fresh.meta.processName, fresh.meta.windowTitle);
    const answer = await askCopilot({
      apiKey,
      model: config.model,
      referer: config.referer,
      appTitle: config.appTitle,
      transcript: text,
      mode: resolvedMode,
      spoilerLevel: spoilerLevel || "story",
      profile: profile || "generic",
      gameTitle: fresh.meta.windowTitle,
      processName: fresh.meta.processName,
      framePaths,
      priorExchanges: formatExchangesForPrompt(config.maxTextExchanges),
      audioPath: null,
    });

    const sessionState = contextBuffer.getSessionState();
    const askIndex = (sessionState?.session?.asks?.length || 0) + 1;
    const answerFile = `asks/${String(askIndex).padStart(4, "0")}-answer.json`;
    if (sessionState?.sessionDir) {
      fs.writeFileSync(
        path.join(sessionState.sessionDir, answerFile),
        JSON.stringify(answer, null, 2),
        "utf8",
      );
      appendAsk(sessionState.sessionDir, {
        at: new Date().toISOString(),
        transcript: text,
        mode: resolvedMode,
        contextFrameFiles: framePaths.map((p) => path.relative(sessionState.sessionDir, p)),
        answerFile,
      });
    }

    addExchange({
      transcript: text,
      summary: summarizeAnswer(answer),
      answerText: JSON.stringify(answer),
    });

    const payload = { type: "answer", transcript: text, answer };
    broadcast(payload);
    broadcastStatus("Ready — hold F9 in game or use Push to talk", false);
    return payload;
  } finally {
    askInFlight = false;
  }
}

async function handlePttStart() {
  if (pttActive) return;
  pttActive = true;
  contextBuffer.touchActivity();
  if (ffmpegAvailable()) {
    startMicRecording(config.micMaxSec);
  }
  broadcastStatus("Listening…", true);
}

async function handlePttStop(body) {
  if (!pttActive) return;
  pttActive = false;
  const audioPath = ffmpegAvailable() ? stopMicRecording() : null;
  if (audioPath) {
    await new Promise((r) => setTimeout(r, 400));
  }
  try {
    await runAsk({
      transcript: body?.transcript || "",
      mode: body?.mode,
      spoilerLevel: body?.spoilerLevel,
      audioPath: audioPath && fs.existsSync(audioPath) ? audioPath : null,
    });
  } catch (err) {
    broadcast({ type: "answer", error: err.message });
    broadcastStatus(`Error: ${err.message}`, false);
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  try {
    if (url.pathname === "/api/status" && req.method === "GET") {
      const state = contextBuffer.getSessionState();
      const capture = contextBuffer.getCaptureState();
      sendJson(res, 200, {
        ok: true,
        port: config.port,
        hasApiKey: Boolean(apiKey),
        ffmpeg: ffmpegAvailable(),
        sessionId: state?.sessionId || null,
        trackedProcess: capture.trackedProcess,
        captureError: capture.lastCaptureError,
        frozen: capture.frozen,
        frames: (state?.session?.frames || []).slice(-4).map((f) => ({
          ...f,
          sessionId: state?.sessionId,
        })),
        captureIntervalSec: config.captureIntervalSec,
      });
      return;
    }

    if (url.pathname === "/api/ask" && req.method === "POST") {
      const body = await readBody(req);
      const result = await runAsk(body);
      sendJson(res, 200, result);
      return;
    }

    if (url.pathname === "/api/ptt/start" && req.method === "POST") {
      await handlePttStart();
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/ptt/stop" && req.method === "POST") {
      const body = await readBody(req);
      await handlePttStop(body);
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/frame" && req.method === "GET") {
      const sessionId = url.searchParams.get("session");
      const file = url.searchParams.get("file");
      if (!sessionId || !file || file.includes("..")) {
        sendJson(res, 400, { error: "Bad frame request" });
        return;
      }
      const full = path.join(config.sessionRoot, sessionId, file);
      if (!full.startsWith(config.sessionRoot) || !fs.existsSync(full)) {
        sendJson(res, 404, { error: "Frame not found" });
        return;
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      fs.createReadStream(full).pipe(res);
      return;
    }

    if (req.method === "GET") {
      serveStatic(req, res);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Server error" });
  }
});

const wss = new WebSocketServer({ server, path: "/ws" });
wss.on("connection", (ws) => {
  clients.add(ws);
  ws.on("close", () => clients.delete(ws));
  const state = contextBuffer.getSessionState();
  ws.send(
    JSON.stringify({
      type: "status",
      text: apiKey ? "Ready" : "Missing OpenRouter API key in .env",
      listening: false,
    }),
  );
  if (state?.session?.frames?.length) {
    ws.send(
      JSON.stringify({
        type: "context",
        frames: state.session.frames.slice(-4).map((f) => ({
          ...f,
          sessionId: state.sessionId,
        })),
      }),
    );
  }
});

contextBuffer.start();

registerPttHotkey(config.pttKey, {
  onPress: () => {
    handlePttStart().catch(() => {});
  },
  onRelease: () => {
    handlePttStop({ spoilerLevel: "story" }).catch(() => {});
  },
}).then((dispose) => {
  process.on("SIGINT", () => {
    dispose?.();
    contextBuffer.stop();
    shutdownCaptureWorker();
    process.exit(0);
  });
});

server.listen(config.port, () => {
  console.log(`[game-copilot] http://localhost:${config.port}`);
  if (!apiKey) {
    console.warn("[game-copilot] OPENROUTER_API_KEY / VITE_OPENROUTER_API_KEY not set");
  }
});
