import { gameProfileNotes } from "./game-detect.mjs";

export function detectModeFromTranscript(text) {
  const t = (text || "").toLowerCase();
  const lootSignals = ["what is this", "keep or sell", "what does this do", "this item", "pick up"];
  const stuckSignals = ["stuck", "what do i do", "where do i go", "help", "now what", "lost"];
  for (const s of lootSignals) {
    if (t.includes(s)) return "loot";
  }
  for (const s of stuckSignals) {
    if (t.includes(s)) return "stuck";
  }
  return "stuck";
}

export function spoilerInstruction(level) {
  if (level === "full") return "User allows full spoilers and wiki-level detail.";
  if (level === "story") return "Avoid major story spoilers. Hints about current area only.";
  return "Minimal spoilers. Only immediate next action visible on screen.";
}

export function buildSystemPrompt({ profile, mode, spoilerLevel }) {
  const profileNote = gameProfileNotes(profile);
  const modeNote =
    mode === "loot"
      ? "User wants item/loot/tooltip help: keep, sell, use, synergy."
      : "User is stuck: give 1-3 immediate next steps.";

  return `You are Game Copilot, an in-game assistant. ${profileNote}
${modeNote}
${spoilerInstruction(spoilerLevel)}
You receive ordered screenshots oldest to newest showing recent gameplay context.
Respond ONLY with valid JSON matching this schema:
{
  "mode": "stuck" | "loot",
  "next_steps": string[],
  "watch_for": string[],
  "optional": string[],
  "loot_verdict": "keep" | "sell" | "use" | "unknown",
  "confidence": "high" | "medium" | "low",
  "clarification": string
}
Keep next_steps to 1-3 short bullets. Use watch_for for hazards. optional for non-critical tips.
If screenshots are unclear, set confidence low and explain in clarification.`;
}

export function buildUserText({
  transcript,
  gameTitle,
  processName,
  profile,
  frameLabels,
  priorExchanges,
}) {
  const parts = [
    `Game: ${gameTitle || "unknown"} (${processName || "unknown"})`,
    `Profile: ${profile || "generic"}`,
    `Player question: ${transcript}`,
  ];
  if (frameLabels.length) {
    parts.push("Screenshot sequence (oldest to newest):");
    for (const label of frameLabels) parts.push(`- ${label}`);
  }
  if (priorExchanges) {
    parts.push("Recent Q&A this session:");
    parts.push(priorExchanges);
  }
  return parts.join("\n");
}

export function parseCopilotResponse(text) {
  const trimmed = (text || "").trim();
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("Model did not return JSON");
    parsed = JSON.parse(trimmed.slice(start, end + 1));
  }
  return {
    mode: parsed.mode === "loot" ? "loot" : "stuck",
    next_steps: Array.isArray(parsed.next_steps) ? parsed.next_steps.map(String) : [],
    watch_for: Array.isArray(parsed.watch_for) ? parsed.watch_for.map(String) : [],
    optional: Array.isArray(parsed.optional) ? parsed.optional.map(String) : [],
    loot_verdict: ["keep", "sell", "use", "unknown"].includes(parsed.loot_verdict)
      ? parsed.loot_verdict
      : "unknown",
    confidence: ["high", "medium", "low"].includes(parsed.confidence)
      ? parsed.confidence
      : "medium",
    clarification: typeof parsed.clarification === "string" ? parsed.clarification : "",
  };
}
