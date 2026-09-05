import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  clearPersistedAgentRunCancellations,
  isAgentRunCancelledPersisted,
  persistAgentRunCancelled,
  readPersistedCancelledAgentRunIds,
} from "@/lib/agent-runs/agent-run-cancellation-storage";

function mockLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  });
}

describe("agent-run-cancellation-storage", () => {
  beforeEach(() => {
    mockLocalStorage();
    clearPersistedAgentRunCancellations();
  });

  it("persists cancelled run ids per team", () => {
    persistAgentRunCancelled(7, 196);
    expect(readPersistedCancelledAgentRunIds(7)).toEqual([196]);
    expect(isAgentRunCancelledPersisted(7, 196)).toBe(true);
    expect(isAgentRunCancelledPersisted(8, 196)).toBe(false);
  });

  it("clears team cancellations", () => {
    persistAgentRunCancelled(7, 196);
    clearPersistedAgentRunCancellations(7);
    expect(readPersistedCancelledAgentRunIds(7)).toEqual([]);
  });
});
