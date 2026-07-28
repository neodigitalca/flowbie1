import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  consumeEntityBulkCsvAutoRun,
  consumeSitemapOptimizerBulkCsvSeed,
  ENTITY_BULK_CSV_AUTO_RUN_KEY,
  SITEMAP_OPTIMIZER_BULK_CSV_SEED_KEY,
  writeEntityBulkCsvHandoff,
  writeSitemapOptimizerBulkCsvSeed,
} from "@/lib/sitemap-optimizer/sitemap-optimizer-bulk-handoff";

const sessionStore = new Map<string, string>();

vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => sessionStore.get(key) ?? null,
  setItem: (key: string, value: string) => {
    sessionStore.set(key, value);
  },
  removeItem: (key: string) => {
    sessionStore.delete(key);
  },
});

describe("sitemap-optimizer-bulk-handoff", () => {
  beforeEach(() => {
    sessionStore.clear();
  });

  it("write then consume returns csv once", () => {
    writeSitemapOptimizerBulkCsvSeed("keyword,title\nkw,Title");
    expect(consumeSitemapOptimizerBulkCsvSeed()).toBe("keyword,title\nkw,Title");
    expect(consumeSitemapOptimizerBulkCsvSeed()).toBeNull();
  });

  it("entity handoff sets csv seed and auto-run flag", () => {
    writeEntityBulkCsvHandoff("keyword,title\nkw,Title");
    expect(sessionStore.get(SITEMAP_OPTIMIZER_BULK_CSV_SEED_KEY)).toBe("keyword,title\nkw,Title");
    expect(sessionStore.get(ENTITY_BULK_CSV_AUTO_RUN_KEY)).toBe("1");
    expect(consumeEntityBulkCsvAutoRun()).toBe(true);
    expect(consumeEntityBulkCsvAutoRun()).toBe(false);
  });
});
