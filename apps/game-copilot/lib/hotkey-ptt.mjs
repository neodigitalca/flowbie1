import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let recordingProc = null;
let recordingPath = null;

export function ffmpegAvailable() {
  const r = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" });
  return r.status === 0;
}

export function startMicRecording(maxSec = 8) {
  stopMicRecording();
  recordingPath = path.join(os.tmpdir(), `game-copilot-mic-${Date.now()}.wav`);
  const args = ["-y", "-f", "dshow", "-i", "audio=Microphone", "-t", String(maxSec), recordingPath];

  recordingProc = spawn("ffmpeg", args, { stdio: "ignore" });
  recordingProc.on("error", () => {
    recordingProc = null;
  });
  return recordingPath;
}

export function stopMicRecording() {
  if (recordingProc) {
    try {
      recordingProc.kill("SIGINT");
    } catch {
      /* ignore */
    }
    recordingProc = null;
  }
  const out = recordingPath;
  recordingPath = null;
  return out;
}

export function startMicRecordingFallback(maxSec = 8) {
  stopMicRecording();
  recordingPath = path.join(os.tmpdir(), `game-copilot-mic-${Date.now()}.wav`);
  const ps = `$path='${recordingPath.replace(/'/g, "''")}'; $dur=${maxSec}; Add-Type -AssemblyName System.Speech; $rec=New-Object System.Speech.AudioFormat.SpeechAudioFormat(16000,[System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,[System.Speech.AudioFormat.AudioChannel]::Mono); $stream=New-Object System.IO.FileStream($path,[System.IO.FileMode]::Create); Start-Sleep -Seconds $dur; $stream.Close()`;
  recordingProc = spawn("powershell", ["-NoProfile", "-Command", ps], { stdio: "ignore" });
  return recordingPath;
}

export async function registerPttHotkey(pttKey, { onPress, onRelease }) {
  try {
    const mod = await import("node-global-key-listener");
    const GlobalKeyboardListener =
      mod.GlobalKeyboardListener || mod.default?.GlobalKeyboardListener;
    if (!GlobalKeyboardListener) throw new Error("GlobalKeyboardListener missing");
    const listener = new GlobalKeyboardListener();
    const handler = (e) => {
      if (e.name !== pttKey) return;
      if (e.state === "DOWN") onPress?.();
      if (e.state === "UP") onRelease?.();
    };
    await listener.addListener(handler);
    return () => listener.kill();
  } catch (err) {
    console.warn("[game-copilot] Hotkey listener failed:", err.message);
    console.warn("[game-copilot] Use panel Push-to-Talk or POST /api/ask.");
    return () => {};
  }
}
