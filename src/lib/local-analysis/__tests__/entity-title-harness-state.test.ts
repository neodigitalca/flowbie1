import { describe, expect, it } from "vitest";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import type { EntityTitleClusterJob } from "@/lib/local-analysis/entity-sap-title-cluster-jobs";
import {
  applyClusterHarnessPhase,
  buildEntityTitleHarnessGroups,
  buildEntityTitleHarnessGroupsFromTargets,
  countEntityHarnessSteps,
  ENTITY_HARNESS_PENDING_LOCATION,
  hydrateEntityTitleHarnessFromSapRows,
  mergeEntityGenerateProgress,
  titlesMapFromRows,
} from "@/lib/local-analysis/entity-title-harness-state";
import type { EntityTitleClusterKeywordTarget } from "@/lib/local-analysis/entity-sap-title-cluster-jobs";

function sapRow(entity: string, title = ""): CSVRow {
  return { keyword: "custom blinds", entity, title, modifier: "", featuredImage: "google-maps" };
}

describe("buildEntityTitleHarnessGroupsFromTargets", () => {
  it("creates placeholder slots across clusters without sapRows", () => {
    const targets: EntityTitleClusterKeywordTarget[] = [
      { id: "a", keyword: "Hunter Douglas blinds", entityHint: "", sapPages: 2, clusterRole: "seed", clusterId: "ca" },
      { id: "b", keyword: "custom shutters", entityHint: "", sapPages: 1, clusterRole: "seed", clusterId: "cb" },
    ];
    const groups = buildEntityTitleHarnessGroupsFromTargets(targets, 50);
    expect(groups).toHaveLength(2);
    expect(groups.reduce((n, g) => n + g.entities.length, 0)).toBe(3);
    expect(groups[0]!.entities[0]!.entity).toBe(ENTITY_HARNESS_PENDING_LOCATION);
  });
});

describe("hydrateEntityTitleHarnessFromSapRows", () => {
  it("replaces placeholder entities with sap row locations", () => {
    const targets: EntityTitleClusterKeywordTarget[] = [
      { id: "a", keyword: "seed", entityHint: "", sapPages: 2, clusterRole: "seed", clusterId: "c1" },
    ];
    const groups = buildEntityTitleHarnessGroupsFromTargets(targets, 50);
    const sapRows = [sapRow("Old Town, Folsom, CA"), sapRow("Russell Ranch, Folsom, CA")];
    const jobs: EntityTitleClusterJob[] = [
      { clusterKey: "c1", seedKeyword: "seed", rowIndices: [0, 1] },
    ];
    const hydrated = hydrateEntityTitleHarnessFromSapRows(groups, jobs, sapRows);
    expect(hydrated[0]!.entities[0]!.entity).toBe("Old Town, Folsom, CA");
    expect(hydrated[0]!.entities[1]!.entity).toBe("Russell Ranch, Folsom, CA");
  });
});

describe("mergeEntityGenerateProgress", () => {
  it("preserves titleHarnessGroups when patch omits them", () => {
    const groups = buildEntityTitleHarnessGroupsFromTargets(
      [{ id: "a", keyword: "seed", entityHint: "", sapPages: 1, clusterRole: "seed", clusterId: "c1" }],
      50,
    );
    const prev = {
      kind: "generate" as const,
      phase: "Reading master rules…",
      completed: 0,
      total: 1,
      titleHarnessGroups: groups,
      harnessPlannedSectionCount: 1,
    };
    const next = mergeEntityGenerateProgress(prev, {
      phase: "Generating SAP rows…",
      completed: 0,
    });
    expect(next.titleHarnessGroups).toEqual(groups);
    expect(next.harnessPlannedSectionCount).toBe(1);
    expect(next.phase).toBe("Generating SAP rows…");
  });
});

describe("buildEntityTitleHarnessGroups", () => {
  it("creates one sub-step per entity location in a cluster", () => {
    const jobs: EntityTitleClusterJob[] = [
      {
        clusterKey: "c1",
        seedKeyword: "Hunter Douglas blinds",
        rowIndices: [0, 1, 2],
      },
    ];
    const sapRows = [
      sapRow("Old Town, Folsom, CA"),
      sapRow("Russell Ranch, Folsom, CA"),
      sapRow("Historic, Folsom, CA"),
    ];
    const groups = buildEntityTitleHarnessGroups(jobs, sapRows);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.seedKeyword).toBe("Hunter Douglas blinds");
    expect(groups[0]!.status).toBe("waiting");
    expect(groups[0]!.entities).toHaveLength(3);
    expect(groups[0]!.entities[0]!.entity).toBe("Old Town, Folsom, CA");
    expect(groups[0]!.entities.every((e) => e.status === "waiting")).toBe(true);
  });
});

describe("applyClusterHarnessPhase", () => {
  it("marks cluster and entities generating on start", () => {
    const groups = buildEntityTitleHarnessGroups(
      [{ clusterKey: "c1", seedKeyword: "seed", rowIndices: [0, 1] }],
      [sapRow("A"), sapRow("B")],
    );
    const next = applyClusterHarnessPhase(groups, 0, "start");
    expect(next[0]!.status).toBe("generating");
    expect(next[0]!.entities.every((e) => e.status === "generating")).toBe(true);
  });

  it("marks entities done with titles when provided on done", () => {
    const groups = buildEntityTitleHarnessGroups(
      [{ clusterKey: "c1", seedKeyword: "seed", rowIndices: [0, 1] }],
      [sapRow("A"), sapRow("B")],
    );
    const started = applyClusterHarnessPhase(groups, 0, "start");
    const titles = titlesMapFromRows(
      [sapRow("A", "Title A"), sapRow("B", "")],
      [0, 1],
    );
    const done = applyClusterHarnessPhase(started, 0, "done", titles);
    expect(done[0]!.status).toBe("done");
    expect(done[0]!.entities[0]!.title).toBe("Title A");
    expect(done[0]!.entities[1]!.title).toBeUndefined();
    expect(countEntityHarnessSteps(done)).toEqual({ done: 2, total: 2 });
  });
});
