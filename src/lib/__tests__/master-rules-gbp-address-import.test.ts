import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  upsertGbpTriplesInMasterRules,
  GBP_ADDRESS_MASTER_RULES_FILENAME,
} from "../master-rules-gbp-address-import";
import {
  clearMasterInstructionsTestCache,
  getMasterInstructionsPayload,
  seedMasterInstructionsForTests,
} from "../master-instructions-storage";

describe("upsertGbpTriplesInMasterRules", () => {
  const siteId = "test-site-gbp-master-rules";
  const lsStore = new Map<string, string>();

  beforeEach(() => {
    lsStore.clear();
    vi.stubGlobal("window", {} as Window);
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => lsStore.get(key) ?? null,
      setItem: (key: string, value: string) => {
        lsStore.set(key, value);
      },
      removeItem: (key: string) => {
        lsStore.delete(key);
      },
    });
    clearMasterInstructionsTestCache();
    seedMasterInstructionsForTests(siteId, {
      sources: [{ name: "other-doc.txt", content: "keep me", uploadedAt: 1 }],
    });
  });

  afterEach(() => {
    clearMasterInstructionsTestCache();
    vi.unstubAllGlobals();
  });

  it("replaces prior GBP-business-gbp.txt on second upsert", async () => {
    expect(await upsertGbpTriplesInMasterRules(siteId, "[Business]\nname\tAdvance Blinds", 100)).toBe(
      "updated",
    );
    expect(await upsertGbpTriplesInMasterRules(siteId, "[Business]\nname\tRenamed", 100)).toBe("updated");

    const payload = getMasterInstructionsPayload(siteId);
    expect(payload.sources.filter((s) => s.name === GBP_ADDRESS_MASTER_RULES_FILENAME)).toHaveLength(1);
    expect(payload.sources.find((s) => s.name === GBP_ADDRESS_MASTER_RULES_FILENAME)?.content).toContain(
      "Renamed",
    );
    expect(payload.sources.find((s) => s.name === GBP_ADDRESS_MASTER_RULES_FILENAME)?.kind).toBe(
      "semantic-triples",
    );
  });
});
