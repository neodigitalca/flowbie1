import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WORDPRESS_SITES_STORAGE_KEY } from "@/components/integrations/types";
import { KWB_BRAND_RULE_CONTENT, PROFILE_BRAND_NAMING_FILENAME } from "../profile-master-rules";
import {
  clearMasterInstructionsTestCache,
  getMasterInstructionsPayload,
} from "../master-instructions-storage";

describe("KWB profile master rules", () => {
  const siteId = "test-kwb-profile-master-rules";
  const lsStore = new Map<string, string>();

  beforeEach(() => {
    lsStore.clear();
    const storage = {
      getItem: (key: string) => lsStore.get(key) ?? null,
      setItem: (key: string, value: string) => {
        lsStore.set(key, value);
      },
      removeItem: (key: string) => {
        lsStore.delete(key);
      },
    };
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("window", { localStorage: storage } as Window);
    clearMasterInstructionsTestCache();
  });

  afterEach(() => {
    clearMasterInstructionsTestCache();
    vi.unstubAllGlobals();
  });

  function seedKwbSite(name = "KWB", siteUrl = "https://kwbllp.com/") {
    lsStore.set(
      WORDPRESS_SITES_STORAGE_KEY,
      JSON.stringify([{ id: siteId, name, siteUrl, enabled: true }]),
    );
  }

  it("adds KWB brand naming rule when master rules load for kwbllp.com", () => {
    seedKwbSite();
    const payload = getMasterInstructionsPayload(siteId);
    const row = payload.sources.find((s) => s.name === PROFILE_BRAND_NAMING_FILENAME);
    expect(row?.kind).toBe("semantic-triples");
    expect(row?.content).toContain("KWB Accountants & Advisors");
    expect(row?.content).toContain("KWB CPAs");
    expect(row?.content).toContain("KWB LLP");
    expect(row?.content).toContain("Yellowknife");
    expect(row?.content).toContain("Red Deer");
    expect(row?.content).toContain("[KWB office geography]");
  });

  it("updates an outdated KWB profile rule in place", () => {
    seedKwbSite();
    const storageKey = `neo_pulse_wp_master_instructions_${siteId}`;
    lsStore.set(
      storageKey,
      JSON.stringify({
        sources: [
          {
            name: PROFILE_BRAND_NAMING_FILENAME,
            content: "[KWB brand naming]\nrule\tOld rule without office geography.",
            uploadedAt: 1,
            kind: "semantic-triples",
          },
        ],
      }),
    );
    const payload = getMasterInstructionsPayload(siteId);
    const row = payload.sources.find((s) => s.name === PROFILE_BRAND_NAMING_FILENAME);
    expect(row?.content).toContain("Yellowknife");
    expect(row?.content).toBe(KWB_BRAND_RULE_CONTENT);
  });

  it("does not duplicate the rule on second load", () => {
    seedKwbSite();
    getMasterInstructionsPayload(siteId);
    const payload = getMasterInstructionsPayload(siteId);
    expect(
      payload.sources.filter((s) => s.name === PROFILE_BRAND_NAMING_FILENAME),
    ).toHaveLength(1);
  });

  it("matches KWB by name when URL is empty", () => {
    seedKwbSite("KWB LLP", "");
    const payload = getMasterInstructionsPayload(siteId);
    expect(payload.sources.some((s) => s.name === PROFILE_BRAND_NAMING_FILENAME)).toBe(true);
  });

  it("skips non-KWB sites", () => {
    lsStore.set(
      WORDPRESS_SITES_STORAGE_KEY,
      JSON.stringify([{ id: siteId, name: "Example Co", siteUrl: "https://example.com/", enabled: true }]),
    );
    const payload = getMasterInstructionsPayload(siteId);
    expect(payload.sources).toHaveLength(0);
  });
});
