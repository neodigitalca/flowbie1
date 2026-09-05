import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  addBenchmarkCategoryTag,
  BENCHMARK_CATEGORY_TAG_MAX_LENGTH,
  collectBenchmarkCategoryTags,
  normalizeBenchmarkCategoryTag,
  readBenchmarkCategoryTags,
  WORDPRESS_BENCHMARK_CATEGORY_TAGS_KEY,
  writeBenchmarkCategoryTags,
} from "../benchmark-category-tags";

describe("benchmark-category-tags", () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("trims and caps labels at 80 characters", () => {
    const long = `  ${"a".repeat(BENCHMARK_CATEGORY_TAG_MAX_LENGTH + 12)}  `;
    expect(normalizeBenchmarkCategoryTag(long)).toHaveLength(BENCHMARK_CATEGORY_TAG_MAX_LENGTH);
    expect(normalizeBenchmarkCategoryTag("  Window treatments  ")).toBe("Window treatments");
  });

  it("adds a tag to the library and skips case-insensitive duplicates", () => {
    expect(addBenchmarkCategoryTag("  HVAC  ")).toEqual(["HVAC"]);
    expect(addBenchmarkCategoryTag("hvac")).toEqual(["HVAC"]);
    expect(addBenchmarkCategoryTag("")).toEqual(["HVAC"]);
    expect(readBenchmarkCategoryTags()).toEqual(["HVAC"]);
  });

  it("collects library tags, site tags, and extras without case duplicates", () => {
    writeBenchmarkCategoryTags(["Window treatments"]);
    const tags = collectBenchmarkCategoryTags(
      [
        { benchmarkCustomTag: "HVAC" },
        { benchmarkCustomTag: "window treatments" },
        { benchmarkCustomTag: "  " },
      ],
      ["Interior design", "hvac"],
    );
    expect(tags).toEqual(["HVAC", "Interior design", "Window treatments"]);
  });

  it("reads an empty library when storage is missing or invalid", () => {
    expect(readBenchmarkCategoryTags()).toEqual([]);
    store.set(WORDPRESS_BENCHMARK_CATEGORY_TAGS_KEY, "{");
    expect(readBenchmarkCategoryTags()).toEqual([]);
    store.set(WORDPRESS_BENCHMARK_CATEGORY_TAGS_KEY, JSON.stringify(["ok", 2, ""]));
    expect(readBenchmarkCategoryTags()).toEqual(["ok"]);
  });
});
