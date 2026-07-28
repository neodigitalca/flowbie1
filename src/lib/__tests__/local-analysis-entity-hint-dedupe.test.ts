import { describe, expect, it } from "vitest";
import type { SapRoughClusterRow } from "@/lib/local-analysis-keyword-cluster";
import {
  backfillEntityHintFromGridPlaceHints,
  backfillEntityHintFromWikipediaPool,
  finalizeEntityHintForKeywordTarget,
  rejectServiceFlavoredLocationString,
  rotateDuplicateSeedEntityHintsFromGrid,
  sanitizeEntityHintForKeywordTarget,
} from "@/lib/local-analysis-entity-hint-dedupe";

describe("rejectServiceFlavoredLocationString", () => {
  it("rejects synthetic city-plus-service mashups without a comma-place form", () => {
    const metro = "Xtown";
    expect(rejectServiceFlavoredLocationString(`${metro} Sports Medicine`)).toBe(true);
    expect(rejectServiceFlavoredLocationString(`${metro} Prenatal Care`)).toBe(true);
  });

  it("keeps comma place lines and quadrant-style labels", () => {
    expect(rejectServiceFlavoredLocationString("Quartername, Samplecity")).toBe(false);
    expect(rejectServiceFlavoredLocationString("Samplecity South")).toBe(false);
  });
});

describe("finalizeEntityHintForKeywordTarget", () => {
  it("clears service-flavored hints after sanitize", () => {
    const metro = "Xtown";
    const kw = "sports injury treatment near me";
    expect(finalizeEntityHintForKeywordTarget(kw, `${metro} Sports Medicine`)).toBe("");
  });

  it("clears internal FSA bucket labels", () => {
    expect(finalizeEntityHintForKeywordTarget("local seo", "FSA T6C")).toBe("");
  });
});

describe("sanitizeEntityHintForKeywordTarget", () => {
  it("clears when hint equals keyword", () => {
    expect(sanitizeEntityHintForKeywordTarget("interior design services", "interior design services")).toBe("");
  });

  it("clears when hint is a phrase fully contained in the keyword (topic vs service)", () => {
    expect(sanitizeEntityHintForKeywordTarget("interior design services", "Interior design")).toBe("");
  });

  it("clears when hint tokens are all covered by the keyword (Window treatment vs custom window treatments)", () => {
    expect(sanitizeEntityHintForKeywordTarget("custom window treatments", "Window treatment")).toBe("");
  });

  it("clears Wikipedia topic disambiguation tails like (window)", () => {
    expect(sanitizeEntityHintForKeywordTarget("woven wood shades", "Shade (window)")).toBe("");
  });

  it("keeps a real place that does not mirror the keyword", () => {
    expect(sanitizeEntityHintForKeywordTarget("coffee shops near me", "Old Strathcona, Edmonton")).toBe(
      "Old Strathcona, Edmonton",
    );
  });

  it("keeps Portland (Oregon) style place titles (capital region in parens)", () => {
    expect(sanitizeEntityHintForKeywordTarget("espresso bars", "Portland (Oregon)")).toBe("Portland (Oregon)");
  });

  it("clears US state-only and province-only hints (too broad for grid)", () => {
    expect(sanitizeEntityHintForKeywordTarget("plumber near me", "Georgia")).toBe("");
    expect(sanitizeEntityHintForKeywordTarget("plumber near me", "Ontario")).toBe("");
  });

  it("keeps City, ST service-area labels", () => {
    expect(sanitizeEntityHintForKeywordTarget("drain cleaning", "Marietta, GA")).toBe("Marietta, GA");
  });
});

describe("backfillEntityHintFromWikipediaPool", () => {
  it("returns a place from the pool when keyword matches no sanitized title until fallback", () => {
    const pool = ["Interior design", "Woodstock, Georgia"];
    const out = backfillEntityHintFromWikipediaPool("interior design services", pool, 0);
    expect(out).toBe("Woodstock, Georgia");
  });

  it("rotates pool by seed index", () => {
    const pool = ["A, GA", "B, GA"];
    expect(backfillEntityHintFromWikipediaPool("kw", pool, 0)).toMatch(/^A, GA$/);
    expect(backfillEntityHintFromWikipediaPool("kw", pool, 1)).toMatch(/^B, GA$/);
  });
});

describe("backfillEntityHintFromGridPlaceHints", () => {
  it("returns a City, ST from the grid pool when the model hint was cleared as topic-like", () => {
    const pool = ["Interior design", "Woodstock, GA", "Marietta, GA"];
    const out = backfillEntityHintFromGridPlaceHints("interior design services", pool, 0);
    expect(out).toBe("Woodstock, GA");
  });

  it("rotates by seed index across distinct cities", () => {
    const pool = ["Woodstock, GA", "Marietta, GA"];
    expect(backfillEntityHintFromGridPlaceHints("blinds installation", pool, 0)).toBe("Woodstock, GA");
    expect(backfillEntityHintFromGridPlaceHints("blinds installation", pool, 1)).toBe("Marietta, GA");
  });
});

describe("rotateDuplicateSeedEntityHintsFromGrid", () => {
  it("reassigns duplicate seed entityHints using distinct grid labels", () => {
    const rows: SapRoughClusterRow[] = [
      { clusterId: "a", clusterRole: "seed", keyword: "k1", sapPages: 3, entityHint: "Marietta, GA" },
      { clusterId: "b", clusterRole: "seed", keyword: "k2", sapPages: 3, entityHint: "Marietta, GA" },
    ];
    const out = rotateDuplicateSeedEntityHintsFromGrid(rows, ["Marietta, GA", "Woodstock, GA"]);
    expect(out[0]!.entityHint).toBe("Marietta, GA");
    expect(out[1]!.entityHint).toBe("Woodstock, GA");
  });

  it("does not change member rows", () => {
    const rows: SapRoughClusterRow[] = [
      { clusterId: "a", clusterRole: "seed", keyword: "k1", sapPages: 3, entityHint: "Marietta, GA" },
      { clusterId: "a", clusterRole: "member", keyword: "k2", sapPages: 2 },
    ];
    const out = rotateDuplicateSeedEntityHintsFromGrid(rows, ["Marietta, GA", "Woodstock, GA"]);
    expect(out[1]!.clusterRole).toBe("member");
    expect(out[1]!.entityHint).toBeUndefined();
  });
});
