const STORAGE_KEY = "neo_pulse_cancelled_agent_runs_v1";

type CancelledRunsByTeam = Record<string, number[]>;

function readStore(): CancelledRunsByTeam {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CancelledRunsByTeam;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: CancelledRunsByTeam): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota errors
  }
}

export function persistAgentRunCancelled(teamId: number, runId: number): void {
  if (runId < 1 || teamId < 1) return;
  const store = readStore();
  const key = String(teamId);
  const ids = new Set(store[key] ?? []);
  ids.add(runId);
  store[key] = [...ids].slice(-200);
  writeStore(store);
}

export function clearPersistedAgentRunCancellations(teamId?: number): void {
  if (typeof localStorage === "undefined") return;
  if (teamId == null) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  const store = readStore();
  delete store[String(teamId)];
  writeStore(store);
}

export function readPersistedCancelledAgentRunIds(teamId: number): number[] {
  if (teamId < 1) return [];
  const store = readStore();
  const ids = store[String(teamId)];
  return Array.isArray(ids) ? ids.filter((id) => typeof id === "number" && id > 0) : [];
}

export function isAgentRunCancelledPersisted(teamId: number, runId: number): boolean {
  return readPersistedCancelledAgentRunIds(teamId).includes(runId);
}
