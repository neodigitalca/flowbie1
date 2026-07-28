import { describe, expect, it } from "vitest";
import {
  createGlobalBulkDedupeState,
  dedupeBulkBenchmarkRows,
  isBannedBulkBenchmarkTopic,
  normalizeDedupeKey,
} from "../vertical-benchmark-bulk-dedupe";
import type { BacklinkBlogPitchOption } from "@/lib/backlink-research/backlink-tile-enriched";

function row(title: string, keyword: string): BacklinkBlogPitchOption {
  return {
    title,
    keyword,
    entity: "",
    modifier: "",
    featuredImage: "y",
  };
}

describe("BULK_CANNIBALIZATION_INSTRUCTIONS", () => {
  it("forbids blind repair DIY vs when-to-call-pro pairs at prompt level", async () => {
    const { BULK_CANNIBALIZATION_INSTRUCTIONS } = await import("../vertical-benchmark-bulk-dedupe");
    expect(BULK_CANNIBALIZATION_INSTRUCTIONS).toMatch(/Blind Repair: A DIY Guide for Common Issues/i);
    expect(BULK_CANNIBALIZATION_INSTRUCTIONS).toMatch(/Blinds Repair: When to Call a Pro/i);
    expect(BULK_CANNIBALIZATION_INSTRUCTIONS).toMatch(/Repair \/ DIY \/ service cluster/i);
  });

  it("merges same-brand product-line URLs into one roundup at prompt level", async () => {
    const { BULK_CANNIBALIZATION_INSTRUCTIONS } = await import("../vertical-benchmark-bulk-dedupe");
    expect(BULK_CANNIBALIZATION_INSTRUCTIONS).toMatch(/same-brand product-line/i);
    expect(BULK_CANNIBALIZATION_INSTRUCTIONS).toMatch(/one roundup/i);
    expect(BULK_CANNIBALIZATION_INSTRUCTIONS).not.toMatch(/Hunter Douglas/i);
  });
});

describe("isBannedBulkBenchmarkTopic", () => {
  it("flags Bali blinds DIY removal titles", () => {
    expect(
      isBannedBulkBenchmarkTopic("remove bali blinds", "Safely Remove Bali Blinds: A DIY Guide"),
    ).toBe(true);
    expect(isBannedBulkBenchmarkTopic("bali blinds", "Bali Blinds vs Hunter Douglas")).toBe(true);
  });

  it("allows unrelated blind topics", () => {
    expect(isBannedBulkBenchmarkTopic("motorized shades", "Motorized Shades Installation Guide")).toBe(
      false,
    );
  });
});

describe("dedupeBulkBenchmarkRows", () => {
  it("drops exact duplicate titles", () => {
    const state = createGlobalBulkDedupeState();
    const rows = [
      row("Coastal Charm: Beat Humidity", "humidity blinds"),
      row("Smart Home Integration for Shades", "smart shades"),
      row("Coastal Charm: Beat Humidity", "coastal blinds"),
    ];
    const { rows: kept, dropped } = dedupeBulkBenchmarkRows(rows, state);
    expect(kept).toHaveLength(2);
    expect(dropped).toHaveLength(1);
    expect(dropped[0].reason).toBe("duplicate_title");
  });

  it("drops exact duplicate Hunter Douglas vs Alta titles", () => {
    const state = createGlobalBulkDedupeState();
    const title = "Hunter Douglas vs. Alta: Which Blinds Fit?";
    const { rows: kept, dropped } = dedupeBulkBenchmarkRows(
      [row(title, "hunter douglas blinds"), row(title, "alta blinds"), row("Wood vs Composite", "wood blinds")],
      state,
    );
    expect(kept).toHaveLength(2);
    expect(dropped[0].reason).toBe("duplicate_title");
  });

  it("drops near-duplicate Top-Down/Bottom-Up cannibal titles", () => {
    const state = createGlobalBulkDedupeState();
    const { rows: kept, dropped } = dedupeBulkBenchmarkRows(
      [
        row("Top-Down/Bottom-Up Shades: Master Light Control", "top down shades"),
        row("Top-Down/Bottom-Up Shades: Versatile Light Control", "bottom up shades"),
      ],
      state,
    );
    expect(kept).toHaveLength(1);
    expect(dropped).toHaveLength(1);
    expect(dropped[0].reason).toBe("cannibal_title");
  });

  it("drops banned Bali blinds rows", () => {
    const state = createGlobalBulkDedupeState();
    const { rows: kept } = dedupeBulkBenchmarkRows(
      [
        row("Safely Remove Bali Blinds: A DIY Guide", "remove bali blinds"),
        row("Motorized Shades Guide", "motorized shades"),
      ],
      state,
    );
    expect(kept).toHaveLength(1);
    expect(kept[0].title).toContain("Motorized");
  });

  it("normalizeDedupeKey treats spacing and case as equal", () => {
    expect(normalizeDedupeKey("Coastal Charm: Beat Humidity")).toBe(
      normalizeDedupeKey("coastal charm   beat humidity"),
    );
  });
});
