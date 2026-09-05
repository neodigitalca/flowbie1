import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { captureForegroundWindowToFile } from "./capture-game-window.mjs";
import { findRunningGameProcess, isGameForeground, resolveGameProfile } from "./game-detect.mjs";
import {
  appendFrame,
  createSessionId,
  frameFileName,
  initSession,
  readSession,
  resolveFramePath,
  writeSession,
} from "./session-log.mjs";

export function createContextBuffer(config, onFrame) {
  let sessionDir = null;
  let sessionId = null;
  let frameCounter = 0;
  let timer = null;
  let captureInFlight = false;
  let lastActivityAt = Date.now();
  let currentGame = null;
  let trackedProcess = null;
  let lastFrameHash = null;
  let staleFrameCount = 0;
  let lastCaptureError = null;

  const intervalMs = Math.max(500, Math.round(config.captureIntervalSec * 1000));

  function hashFile(filePath) {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
  }

  function touchActivity() {
    lastActivityAt = Date.now();
  }

  function ensureSession(meta) {
    const profile = resolveGameProfile(meta.processName, meta.windowTitle);
    const gameKey = `${meta.processName}:${profile}`;
    if (sessionDir && currentGame === gameKey) return sessionDir;

    sessionId = createSessionId(meta.processName);
    sessionDir = path.join(config.sessionRoot, sessionId);
    frameCounter = 0;
    currentGame = gameKey;
    trackedProcess = meta.processName || null;
    initSession(
      sessionDir,
      sessionId,
      {
        process: meta.processName,
        title: meta.windowTitle,
        profile,
      },
      config,
    );
    return sessionDir;
  }

  function pruneFrames(session) {
    const max = config.historyFrameCount;
    while (session.frames.length > max) {
      const removed = session.frames.shift();
      if (removed?.file) {
        const full = resolveFramePath(sessionDir, removed.file);
        try {
          fs.unlinkSync(full);
        } catch {
          /* ignore */
        }
      }
    }
    writeSession(sessionDir, session);
  }

  async function tick() {
    if (captureInFlight) return;
    const idleMs = config.idlePauseMin * 60 * 1000;
    if (Date.now() - lastActivityAt > idleMs) return;

    captureInFlight = true;
    let meta;
    const tmp = path.join(config.sessionRoot, "_tmp", `cap-${Date.now()}.png`);
    try {
      fs.mkdirSync(path.dirname(tmp), { recursive: true });
      meta = await captureForegroundWindowToFile(tmp, {
        processName: trackedProcess || undefined,
      });
      lastCaptureError = null;
    } catch (err) {
      lastCaptureError = err instanceof Error ? err.message : String(err);
      if (onFrame) {
        onFrame({
          sessionDir,
          frame: null,
          frames: sessionDir ? readSession(sessionDir)?.frames || [] : [],
          staleFrameCount,
          frozen: staleFrameCount >= 4,
          captureError: lastCaptureError,
        });
      }
      return;
    } finally {
      captureInFlight = false;
    }

    if (!isGameForeground(meta)) {
      if (!trackedProcess || meta.processName !== trackedProcess) {
        try {
          fs.unlinkSync(tmp);
        } catch {
          /* ignore */
        }
        return;
      }
    }

    if (!trackedProcess && isGameForeground(meta)) {
      trackedProcess = meta.processName;
    }

    const dir = ensureSession(meta);
    frameCounter += 1;
    const rel = frameFileName(frameCounter);
    const target = path.join(dir, rel);
    fs.renameSync(tmp, target);
    meta.filePath = target;

    const entry = {
      index: frameCounter,
      file: rel,
      capturedAt: new Date().toISOString(),
      windowTitle: meta.windowTitle,
      processName: meta.processName,
    };
    const session = appendFrame(dir, entry);
    pruneFrames(session);

    const frameHash = hashFile(target);
    if (frameHash === lastFrameHash) staleFrameCount += 1;
    else {
      staleFrameCount = 0;
      lastFrameHash = frameHash;
    }

    touchActivity();
    if (onFrame) {
      onFrame({
        sessionDir: dir,
        frame: entry,
        frames: session.frames,
        staleFrameCount,
        frozen: staleFrameCount >= 4,
        captureError: null,
      });
    }
  }

  function scheduleLoop() {
    timer = setInterval(() => {
      tick().catch(() => {});
    }, intervalMs);
  }

  function start() {
    if (timer) return;
    if (!trackedProcess) {
      trackedProcess = findRunningGameProcess();
    }
    scheduleLoop();
    tick().catch(() => {});
  }

  function setTrackedProcess(processName) {
    trackedProcess = processName || null;
    touchActivity();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function getBufferedFramePaths() {
    if (!sessionDir) return [];
    const session = readSession(sessionDir);
    if (!session) return [];
    return session.frames.map((f) => resolveFramePath(sessionDir, f.file));
  }

  function getSessionState() {
    if (!sessionDir) return null;
    return { sessionDir, sessionId, session: readSession(sessionDir) };
  }

  async function captureFreshFrame() {
    touchActivity();
    if (!sessionDir) {
      const tmpDir = path.join(config.sessionRoot, createSessionId("ask"));
      fs.mkdirSync(path.join(tmpDir, "frames"), { recursive: true });
      initSession(
        tmpDir,
        path.basename(tmpDir),
        { process: "", title: "", profile: "generic" },
        config,
      );
      sessionDir = tmpDir;
      sessionId = path.basename(tmpDir);
      frameCounter = 0;
    }

    const session = readSession(sessionDir);
    const last = session?.frames?.[session.frames.length - 1];
    if (last?.capturedAt) {
      const ageMs = Date.now() - new Date(last.capturedAt).getTime();
      if (ageMs < intervalMs) {
        const existing = resolveFramePath(sessionDir, last.file);
        return {
          sessionDir,
          entry: last,
          meta: {
            windowTitle: last.windowTitle,
            processName: last.processName,
          },
          path: existing,
          reused: true,
        };
      }
    }

    frameCounter += 1;
    const rel = frameFileName(frameCounter);
    const outPath = path.join(sessionDir, rel);
    const meta = await captureForegroundWindowToFile(outPath, {
      processName: trackedProcess || undefined,
    });
    const entry = {
      index: frameCounter,
      file: rel,
      capturedAt: new Date().toISOString(),
      windowTitle: meta.windowTitle,
      processName: meta.processName,
    };
    appendFrame(sessionDir, entry);
    pruneFrames(readSession(sessionDir));
    return { sessionDir, entry, meta, path: outPath, reused: false };
  }

  function getCaptureState() {
    return {
      trackedProcess,
      lastCaptureError,
      staleFrameCount,
      frozen: staleFrameCount >= 4,
    };
  }

  return {
    start,
    stop,
    touchActivity,
    getBufferedFramePaths,
    getSessionState,
    captureFreshFrame,
    setTrackedProcess,
    getCaptureState,
  };
}
