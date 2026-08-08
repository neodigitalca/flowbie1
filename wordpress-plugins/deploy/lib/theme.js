const ACCENT = "\x1b[38;2;132;189;0m";
const TEXT = "\x1b[97m";
const ERR = "\x1b[38;2;255;90;90m";
const TRACK = "\x1b[38;2;45;65;0m";
const R = "\x1b[0m";
const B = "\x1b[1m";

export const accent = (s) => `${ACCENT}${s}${R}`;
export const ok = (s) => `${ACCENT}${s}${R}`;
export const err = (s) => `${ERR}${s}${R}`;
export const bold = (s) => `${TEXT}${B}${s}${R}`;

export function header(label) {
  console.log(accent("▸") + " " + bold(label));
  console.log();
}

export function stripAnsi(s) {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

export function pct(done, total) {
  return total ? `${Math.round((done / total) * 100)}%` : "0%";
}

export function bar(ratio) {
  const w = 32;
  const clamped = Math.max(0, Math.min(1, ratio));
  const filled = Math.round(clamped * w);
  return accent("█".repeat(filled)) + `${TRACK}${"░".repeat(w - filled)}${R}`;
}
