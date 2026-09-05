import { spawnSync } from "node:child_process";

const SKIP_PROCESSES = new Set([
  "cursor",
  "code",
  "explorer",
  "searchhost",
  "startmenuexperiencehost",
  "shellexperiencehost",
  "applicationframehost",
  "systemsettings",
  "textinputhost",
  "docker desktop",
  "slack",
  "spotify",
  "steamwebhelper",
  "steamservice",
  "steam",
  "chrome",
  "msedge",
  "firefox",
  "powershell",
  "windowsterminal",
  "cmd",
  "node",
]);

const TRACKED_GAME_PROCESSES = ["isaac-ng"];

const GAME_HINTS = [
  { match: (p, t) => p === "isaac-ng" || t.includes("binding of isaac"), profile: "isaac" },
  { match: (p, t) => t.includes("hitman"), profile: "hitman" },
  { match: (p, t) => t.includes("wukong") || t.includes("black myth"), profile: "wukong" },
  { match: (p, t) => t.includes("ghost of tsushima"), profile: "tsushima" },
  { match: (p, t) => t.includes("battlefield"), profile: "battlefield" },
  { match: (p, t) => t.includes("death stranding"), profile: "deathstranding" },
  { match: (p, t) => t.includes("jedi"), profile: "jedi" },
];

export function resolveGameProfile(processName, windowTitle) {
  const p = (processName || "").toLowerCase();
  const t = (windowTitle || "").toLowerCase();
  if (!p || SKIP_PROCESSES.has(p)) return null;
  for (const hint of GAME_HINTS) {
    if (hint.match(p, t)) return hint.profile;
  }
  if (t.length > 2) return "generic";
  return null;
}

export function isGameForeground(info) {
  if (!info?.processName) return false;
  return resolveGameProfile(info.processName, info.windowTitle) !== null;
}

export function findRunningGameProcess() {
  try {
    for (const name of TRACKED_GAME_PROCESSES) {
      const result = spawnSync(
        "powershell",
        [
          "-NoProfile",
          "-Command",
          `$p = Get-Process -Name '${name}' -ErrorAction SilentlyContinue; if ($p) { $p[0].ProcessName }`,
        ],
        { encoding: "utf8", windowsHide: true },
      );
      const found = (result.stdout || "").trim().toLowerCase();
      if (found) return found;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function gameProfileNotes(profile) {
  const notes = {
    isaac: "Roguelike. Focus on room type, items, synergies, boss patterns. Short actionable tips.",
    hitman: "Stealth sandbox. Routes, disguises, targets, SA rating. Avoid spoilers beyond current mission.",
    wukong: "Action RPG. Boss phases, paths, gear. Story-safe unless user asks for full spoilers.",
    tsushima: "Open world. Next objective, collectibles in current zone only.",
    battlefield: "Multiplayer. General tactics only, no live cheat-like callouts.",
    generic: "Use visible UI and environment. One to three next steps.",
  };
  return notes[profile] || notes.generic;
}
