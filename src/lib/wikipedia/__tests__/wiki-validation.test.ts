import { beforeEach, describe, expect, it, vi } from "vitest";

import { filterOrderedTitlesToExistingCanonical, validateEntitiesExist } from "../wiki-validation";

describe("filterOrderedTitlesToExistingCanonical", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns canonical titles in order and drops missing pages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          query: {
            pages: [
              { title: "Alpha", missing: true },
              { title: "Beta Town" },
            ],
          },
        }),
      }),
    );

    const out = await filterOrderedTitlesToExistingCanonical(["Alpha", "Beta Town", "Gamma"]);
    expect(out).toEqual(["Beta Town"]);
  });

  it("resolves normalized and redirect chains to a non-missing page title", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          query: {
            normalized: [{ from: "beta town", to: "Beta Town" }],
            redirects: [{ from: "Beta Town", to: "Beta (town)" }],
            pages: [{ title: "Beta (town)" }],
          },
        }),
      }),
    );

    const out = await filterOrderedTitlesToExistingCanonical(["beta town"]);
    expect(out).toEqual(["Beta (town)"]);
  });
});

describe("validateEntitiesExist", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("marks entity exists with API canonical title after redirects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          query: {
            normalized: [{ from: "beta town", to: "Beta Town" }],
            redirects: [{ from: "Beta Town", to: "Beta (town)" }],
            pages: [{ title: "Beta (town)" }],
          },
        }),
      }),
    );

    const results = await validateEntitiesExist(["beta town"]);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      entity: "beta town",
      exists: true,
      title: "Beta (town)",
    });
    expect(results[0]!.url).toContain("en.wikipedia.org/wiki/");
    expect(results[0]!.url).toContain("Beta");
  });
});
