import { describe, expect, it } from "vitest";
import {
  SITEMAP_OPTIMIZER_STEPS_ENTITY,
  sitemapOptimizerDoneStepLines,
  sitemapOptimizerOverallPct,
  sitemapOptimizerPhasePct,
  sitemapOptimizerProgressLines,
  sitemapOptimizerStepStatus,
  stepsForRunMode,
} from "@/lib/sitemap-optimizer/progress-display";

describe("sitemap-optimizer-progress", () => {
  it("increases overall pct through phases", () => {
    const inv = sitemapOptimizerOverallPct({ phase: "inventory", completed: 0, total: 1 });
    const gsc = sitemapOptimizerOverallPct({
      phase: "gsc",
      completed: 50,
      total: 100,
      inventoryCount: 100,
    });
    const done = sitemapOptimizerOverallPct({ phase: "done", completed: 1, total: 1 });
    expect(gsc).toBeGreaterThan(inv);
    expect(done).toBe(100);
  });

  it("reports gsc step percent", () => {
    expect(
      sitemapOptimizerPhasePct({ phase: "gsc", completed: 25, total: 100 }),
    ).toBe(25);
  });

  it("marks prior steps done when on merge", () => {
    expect(sitemapOptimizerStepStatus("inventory", "merge")).toBe("done");
    expect(sitemapOptimizerStepStatus("merge", "merge")).toBe("active");
    expect(sitemapOptimizerStepStatus("gsc", "merge")).toBe("done");
  });

  it("entity steps advance Keep → Compress → Transform without regression", () => {
    expect(sitemapOptimizerStepStatus("gsc_triage", "gsc_triage", undefined, true)).toBe("active");
    expect(sitemapOptimizerStepStatus("gsc_triage", "clustering", undefined, true)).toBe("done");
    expect(sitemapOptimizerStepStatus("clustering", "clustering", undefined, true)).toBe("active");
    expect(sitemapOptimizerStepStatus("clustering", "merge", undefined, true)).toBe("done");
    expect(sitemapOptimizerStepStatus("merge", "merge", undefined, true)).toBe("active");
    expect(sitemapOptimizerStepStatus("gsc_triage", "merge", undefined, true)).toBe("done");
  });

  it("entity drawer has only Keep Compress Transform", () => {
    expect(SITEMAP_OPTIMIZER_STEPS_ENTITY).toHaveLength(3);
    expect(SITEMAP_OPTIMIZER_STEPS_ENTITY.map((s) => s.label)).toEqual([
      "Keep",
      "Compress",
      "Transform",
    ]);
    expect(stepsForRunMode("wordpress", true).map((s) => s.label)).toEqual([
      "Keep",
      "Compress",
      "Transform",
    ]);
  });

  it("entity inventory and GSC map onto Keep", () => {
    expect(sitemapOptimizerStepStatus("gsc_triage", "inventory", undefined, true)).toBe("active");
    expect(sitemapOptimizerStepStatus("clustering", "inventory", undefined, true)).toBe("pending");
    expect(sitemapOptimizerStepStatus("merge", "inventory", undefined, true)).toBe("pending");
    expect(sitemapOptimizerStepStatus("gsc_triage", "gsc", undefined, true)).toBe("active");
    expect(sitemapOptimizerStepStatus("clustering", "gsc", undefined, true)).toBe("pending");
  });

  it("entity content_sheet maps onto Transform", () => {
    expect(sitemapOptimizerStepStatus("gsc_triage", "content_sheet", undefined, true)).toBe("done");
    expect(sitemapOptimizerStepStatus("clustering", "content_sheet", undefined, true)).toBe("done");
    expect(sitemapOptimizerStepStatus("merge", "content_sheet", undefined, true)).toBe("active");
  });

  it("uses grid step order for grid_csv run mode", () => {
    expect(
      sitemapOptimizerStepStatus("ingest_csv", "clustering", "grid_csv"),
    ).toBe("done");
    expect(
      sitemapOptimizerStepStatus("clustering", "clustering", "grid_csv"),
    ).toBe("active");
    expect(sitemapOptimizerStepStatus("gsc", "merge", "grid_csv")).toBe("pending");
  });

  it("inventory done distinguishes catalog from analyzed subset", () => {
    expect(
      sitemapOptimizerDoneStepLines("inventory", {
        phase: "clustering",
        completed: 0,
        total: 2,
        inventoryCount: 639,
        gscAnalyzedPostCount: 42,
        gscTrafficFilter: "traffic",
      }),
    ).toEqual(["639 URLs in catalog", "42 with traffic (clicks)"]);
  });

  it("gsc progress shows only the live status line without bogus step fractions", () => {
    const lines = sitemapOptimizerProgressLines({
      phase: "gsc",
      completed: 3,
      total: 4,
      detail: "Top queries 62 / 222 blogs with traffic",
      gscImportSubphase: "queries",
      gscQueryProgressCompleted: 62,
      gscQueryProgressTotal: 222,
      inventoryCount: 639,
      gscAnalyzedPostCount: 222,
    });
    expect(lines).toEqual(["Top queries 62 / 222 blogs with traffic"]);
    expect(lines.join(" ")).not.toMatch(/3\.\d+/);
  });

  it("clustering progress uses batch and merge group counts not step fractions", () => {
    const lines = sitemapOptimizerProgressLines({
      phase: "clustering",
      completed: 3,
      total: 7,
      clustersCreated: 42,
      urlsProcessed: 180,
      gscAnalyzedPostCount: 417,
      clusteringSubphase: "batch",
    });
    expect(lines).toEqual([
      "Cluster batch 3 / 7",
      "42 merge groups",
      "180 / 417 URLs grouped",
    ]);
    expect(lines.join(" ")).not.toMatch(/step\s+\d/i);
  });

  it("entity compress progress uses packed families copy", () => {
    const lines = sitemapOptimizerProgressLines({
      phase: "clustering",
      completed: 40,
      total: 130,
      clustersCreated: 8,
      urlsProcessed: 40,
      gscAnalyzedPostCount: 130,
      clusteringSubphase: "compress",
      entityPrimary: true,
    });
    expect(lines).toEqual(["8 families", "40 / 130 service areas packed"]);
  });

  it("entity transform progress uses Transform families copy", () => {
    expect(
      sitemapOptimizerProgressLines({
        phase: "merge",
        completed: 3,
        total: 8,
        entityPrimary: true,
      }),
    ).toEqual(["Transform 3 / 8 families"]);
  });

  it("gsc done shows traffic filter label", () => {
    expect(
      sitemapOptimizerDoneStepLines("gsc", {
        phase: "clustering",
        completed: 0,
        total: 2,
        inventoryCount: 639,
        gscAnalyzedPostCount: 42,
        gscTrafficFilter: "traffic",
      }),
    ).toEqual(["42 with traffic (clicks)", "639 URLs in catalog"]);
  });

  it("entity-primary inventory uses service-area labels", () => {
    expect(
      sitemapOptimizerDoneStepLines("inventory", {
        phase: "gsc",
        completed: 0,
        total: 1,
        inventoryCount: 32,
        gscAnalyzedPostCount: 32,
        gscTrafficFilter: "all",
        entityPrimary: true,
      }),
    ).toEqual(["32 service areas in catalog"]);
    expect(
      sitemapOptimizerDoneStepLines("gsc", {
        phase: "clustering",
        completed: 0,
        total: 1,
        inventoryCount: 32,
        gscAnalyzedPostCount: 32,
        gscTrafficFilter: "all",
        entityPrimary: true,
      }),
    ).toEqual(["32 all service areas"]);
  });

  it("increases overall pct for grid ingest and clustering", () => {
    const ingest = sitemapOptimizerOverallPct({
      phase: "ingest_csv",
      completed: 100,
      total: 100,
      runMode: "grid_csv",
    });
    const cluster = sitemapOptimizerOverallPct({
      phase: "clustering",
      completed: 50,
      total: 100,
      runMode: "grid_csv",
      uploadRowCount: 100,
    });
    expect(cluster).toBeGreaterThan(ingest);
  });
});
