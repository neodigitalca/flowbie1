import fs from "node:fs";
import path from "node:path";

export function createSessionId(processName) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeProc = (processName || "game").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${stamp}_${safeProc}`;
}

export function initSession(sessionDir, sessionId, game, config) {
  fs.mkdirSync(path.join(sessionDir, "frames"), { recursive: true });
  fs.mkdirSync(path.join(sessionDir, "asks"), { recursive: true });
  const session = {
    sessionId,
    startedAt: new Date().toISOString(),
    game: game || { process: "", title: "", profile: "generic" },
    config: {
      historyFrameCount: config.historyFrameCount,
      captureIntervalSec: config.captureIntervalSec,
    },
    frames: [],
    asks: [],
  };
  writeSession(sessionDir, session);
  return session;
}

export function readSession(sessionDir) {
  const file = path.join(sessionDir, "session.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function writeSession(sessionDir, session) {
  const file = path.join(sessionDir, "session.json");
  fs.writeFileSync(file, JSON.stringify(session, null, 2), "utf8");
}

export function appendFrame(sessionDir, frameEntry) {
  const session = readSession(sessionDir);
  if (!session) throw new Error("Session missing");
  session.frames.push(frameEntry);
  writeSession(sessionDir, session);
  return session;
}

export function appendAsk(sessionDir, askEntry) {
  const session = readSession(sessionDir);
  if (!session) throw new Error("Session missing");
  session.asks.push(askEntry);
  writeSession(sessionDir, session);
  return session;
}

export function frameFileName(index) {
  return `frames/${String(index).padStart(4, "0")}.png`;
}

export function resolveFramePath(sessionDir, relativeFile) {
  return path.join(sessionDir, relativeFile.replace(/\//g, path.sep));
}
