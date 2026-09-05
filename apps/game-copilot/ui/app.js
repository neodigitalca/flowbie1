const statusEl = document.getElementById("status");
const nextStepsEl = document.getElementById("nextSteps");
const watchForEl = document.getElementById("watchFor");
const optionalEl = document.getElementById("optional");
const lootBlockEl = document.getElementById("lootBlock");
const lootVerdictEl = document.getElementById("lootVerdict");
const clarificationEl = document.getElementById("clarification");
const contextStripEl = document.getElementById("contextStrip");
const spoilerEl = document.getElementById("spoiler");
const askTextEl = document.getElementById("askText");
const pttBtn = document.getElementById("ptt");
const modeStuckBtn = document.getElementById("modeStuck");
const modeLootBtn = document.getElementById("modeLoot");

let ws = null;
let manualMode = "stuck";
let pttDown = false;

function setList(items, el) {
  el.innerHTML = "";
  for (const item of items || []) {
    const li = document.createElement("li");
    li.textContent = item;
    el.appendChild(li);
  }
}

function renderAnswer(payload) {
  if (payload.error) {
    clarificationEl.textContent = payload.error;
    return;
  }
  const a = payload.answer || payload;
  setList(a.next_steps, nextStepsEl);
  setList(a.watch_for, watchForEl);
  setList(a.optional, optionalEl);
  if (a.mode === "loot" || a.loot_verdict) {
    lootBlockEl.hidden = false;
    lootVerdictEl.textContent = (a.loot_verdict || "unknown").toUpperCase();
  } else {
    lootBlockEl.hidden = true;
  }
  clarificationEl.textContent = a.clarification || "";
  if (payload.transcript) {
    statusEl.textContent = `Heard: ${payload.transcript}`;
  }
}

function renderContext(frames) {
  contextStripEl.innerHTML = "";
  for (const f of (frames || []).slice(-4)) {
    const img = document.createElement("img");
    const stamp = encodeURIComponent(f.capturedAt || Date.now());
    img.src = `/api/frame?session=${encodeURIComponent(f.sessionId || "")}&file=${encodeURIComponent(f.file || f)}&t=${stamp}`;
    img.alt = f.file || "frame";
    contextStripEl.appendChild(img);
  }
}

function connectWs() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  ws = new WebSocket(`${proto}://${location.host}/ws`);
  ws.onopen = () => {
    statusEl.textContent = "Ready — hold F9 in game or use Push to talk";
  };
  ws.onclose = () => {
    statusEl.textContent = "Reconnecting…";
    setTimeout(connectWs, 2000);
  };
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.type === "status") {
      statusEl.textContent = msg.text;
      statusEl.classList.toggle("listening", Boolean(msg.listening));
      pttBtn.classList.toggle("recording", Boolean(msg.listening));
    }
    if (msg.type === "answer") renderAnswer(msg);
    if (msg.type === "context") {
      renderContext(msg.frames);
      if (msg.captureError) {
        statusEl.textContent = `Capture failed: ${msg.captureError}`;
      } else if (msg.frozen) {
        statusEl.textContent = "Same frame 4+ times — unpause Isaac (Esc) or keep playing";
      }
    }
  };
}

function sendAsk(body) {
  fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch((err) => {
    clarificationEl.textContent = err.message;
  });
}

modeStuckBtn.addEventListener("click", () => {
  manualMode = "stuck";
  modeStuckBtn.classList.add("active");
  modeLootBtn.classList.remove("active");
});

modeLootBtn.addEventListener("click", () => {
  manualMode = "loot";
  modeLootBtn.classList.add("active");
  modeStuckBtn.classList.remove("active");
});

document.getElementById("askSend").addEventListener("click", () => {
  const transcript = askTextEl.value.trim();
  if (!transcript) return;
  sendAsk({
    transcript,
    mode: manualMode,
    spoilerLevel: spoilerEl.value,
  });
  askTextEl.value = "";
});

askTextEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter") document.getElementById("askSend").click();
});

async function panelPttStart() {
  pttDown = true;
  pttBtn.classList.add("recording");
  await fetch("/api/ptt/start", { method: "POST" });
}

async function panelPttStop() {
  if (!pttDown) return;
  pttDown = false;
  pttBtn.classList.remove("recording");
  await fetch("/api/ptt/stop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: manualMode,
      spoilerLevel: spoilerEl.value,
    }),
  });
}

pttBtn.addEventListener("mousedown", panelPttStart);
pttBtn.addEventListener("mouseup", panelPttStop);
pttBtn.addEventListener("mouseleave", () => {
  if (pttDown) panelPttStop();
});

connectWs();

async function refreshContextStrip() {
  try {
    const r = await fetch("/api/status");
    const s = await r.json();
    if (s.frames?.length) renderContext(s.frames);
    if (s.trackedProcess) {
      statusEl.textContent = `Tracking ${s.trackedProcess} · every ${s.captureIntervalSec || 2}s`;
    } else if (s.sessionId) {
      statusEl.textContent = `Tracking ${s.frames?.[0]?.processName || "game"} · every ${s.captureIntervalSec || 2}s`;
    }
    if (s.captureError) {
      statusEl.textContent = `Capture failed: ${s.captureError}`;
    } else if (s.frozen) {
      statusEl.textContent = "Same frame 4+ times — unpause Isaac (Esc) or keep playing";
    }
  } catch {
    /* ignore */
  }
}

refreshContextStrip();
setInterval(refreshContextStrip, 2000);
