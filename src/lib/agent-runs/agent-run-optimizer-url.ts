import type { BlogGeneratorSectionId } from "@/components/blog-generator/blog-generator-sections";

const AGENT_RUN_VIEW_HASH_RE = /^generator\/([a-z-]+)\/agent-run\/(\d+)$/;

export function buildAgentRunViewHash(runId: number, section: BlogGeneratorSectionId | string): string {
  return `generator/${section}/agent-run/${runId}`;
}

export function buildAgentRunOptimizerHash(runId: number): string {
  return buildAgentRunViewHash(runId, "opt");
}

export function buildAgentRunOptimizerPath(runId: number): string {
  const base = typeof window !== "undefined" ? window.location.pathname : "/app/";
  const search = typeof window !== "undefined" ? window.location.search : "";
  return `${base}${search}#${buildAgentRunOptimizerHash(runId)}`;
}

export function parseAgentRunIdFromHash(hash: string): number | null {
  const body = hash.replace(/^#/, "").trim();
  const match = body.match(AGENT_RUN_VIEW_HASH_RE);
  if (!match) return null;
  const id = Number(match[2]);
  return id > 0 ? id : null;
}

export function parseAgentRunIdFromLocationHash(): number | null {
  if (typeof window === "undefined") return null;
  return parseAgentRunIdFromHash(window.location.hash);
}

export function isAgentRunOptimizerLocationHash(hash?: string): boolean {
  const body = (hash ?? (typeof window !== "undefined" ? window.location.hash : "")).replace(/^#/, "").trim();
  return AGENT_RUN_VIEW_HASH_RE.test(body);
}

export function writeAgentRunViewHash(runId: number | null, section: BlogGeneratorSectionId | string = "opt"): void {
  if (typeof window === "undefined") return;
  const hash = runId && runId > 0 ? buildAgentRunViewHash(runId, section) : `generator/${section}`;
  writeLocationHash(hash);
}

export function writeAgentRunOptimizerHash(runId: number | null): void {
  writeAgentRunViewHash(runId, "opt");
}

export function writeGeneratorSectionHash(section: string): void {
  writeLocationHash(`generator/${section}`);
}

function writeLocationHash(hash: string): void {
  if (typeof window === "undefined") return;
  const current = window.location.hash.replace(/^#/, "").trim();
  if (current === hash) return;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${hash}`);
}

export function parseGeneratorSectionFromHash(hash: string): string | null {
  const body = hash.replace(/^#/, "").trim();
  const agentRunMatch = body.match(AGENT_RUN_VIEW_HASH_RE);
  if (agentRunMatch) return agentRunMatch[1];
  if (!body.startsWith("generator/")) return null;
  const parts = body.split("/").filter(Boolean);
  if (parts[0] !== "generator" || !parts[1]) return null;
  return parts[1];
}

export function isGeneratorHash(hash: string): boolean {
  const body = hash.replace(/^#/, "").trim();
  return body === "generator" || body.startsWith("generator/");
}
