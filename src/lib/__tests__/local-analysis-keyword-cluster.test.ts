import { describe, expect, it } from "vitest";
import {
  collapseRoughToSeedGroupsOnly,
  flattenClustersToRoughRows,
  legacyTargetsToRoughRows,
  resolveClusterSeedEntityHint,
  seedRowIdForKeywordTarget,
  stripeEntityHintsFromOrderedPool,
  sumSapPagesForRoughRows,
  ensureMemberClusterIdsFromSeed,
  ensureUniqueClusterIdPerSeedGroup,
  expandKeywordTargetsForApi,
  inheritKeywordTargetEntityHints,
  propagateSeedEntityHintsToMembers,
} from "@/lib/local-analysis-keyword-cluster";

describe("local-analysis-keyword-cluster", () => {
  it("parses clusters JSON and flattens seed then members with roles", () => {
    const clusters = [
        {
          clusterId: "c1",
          seedKeyword: "roof repair",
          wikiEntityHint: "Roof",
          sapPagesSeed: 6,
          members: [{ keyword: "shingle replacement" }, { keyword: "gutter work" }],
        },
      ];
    const rows = flattenClustersToRoughRows(clusters);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      keyword: "roof repair",
      sapPages: 0,
      entityHint: "Roof",
      clusterId: "c1",
      clusterRole: "seed",
    });
    expect(rows[1]).toMatchObject({
      keyword: "shingle replacement",
      sapPages: 3,
      clusterId: "c1",
      clusterRole: "member",
    });
    expect(rows[1].entityHint).toBeUndefined();
    expect(rows[2]).toMatchObject({ keyword: "gutter work", sapPages: 3, clusterRole: "member" });
  });

  it("ensureMemberClusterIdsFromSeed copies seed clusterId onto members when missing", () => {
    const out = ensureMemberClusterIdsFromSeed([
      { id: "s", keyword: "a", entityHint: "E", sapPages: 0, clusterId: "grp", clusterRole: "seed" },
      { id: "m", keyword: "b", entityHint: "", sapPages: 3, clusterRole: "member" },
    ]);
    expect(out[1]!.clusterId).toBe("grp");
  });

  it("ensureUniqueClusterIdPerSeedGroup assigns fresh clusterIds when model reuses one id", () => {
    const rough = flattenClustersToRoughRows([
      {
        clusterId: "Interior Design",
        seedKeyword: "interior design",
        wikiEntityHint: "Place A",
        sapPagesSeed: 3,
        members: [{ keyword: "living room design" }],
      },
      {
        clusterId: "Interior Design",
        seedKeyword: "custom blinds",
        wikiEntityHint: "Place B",
        sapPagesSeed: 3,
        members: [{ keyword: "window blinds" }],
      },
    ]);
    const out = ensureUniqueClusterIdPerSeedGroup(rough);
    const seedIds = out.filter((r) => r.clusterRole === "seed").map((r) => r.clusterId);
    expect(seedIds[0]).not.toBe(seedIds[1]);
    expect(out.filter((r) => r.clusterRole === "member").map((r) => r.clusterId)).toEqual([
      seedIds[0],
      seedIds[1],
    ]);
  });

  it("sumSapPagesForRoughRows uses member SAP when the cluster has members (seed SAP ignored)", () => {
    const rough = [
      { keyword: "seed kw", sapPages: 0, clusterId: "c", clusterRole: "seed" as const },
      { keyword: "member kw", sapPages: 7, clusterId: "c", clusterRole: "member" as const },
    ];
    expect(sumSapPagesForRoughRows(rough)).toBe(7);
  });

  it("legacy flat targets become one seed cluster per row", () => {
    const rows = legacyTargetsToRoughRows([
      { keyword: "a", sapPages: 2, entityHint: "A" },
      { keyword: "b", sapPages: 2 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.clusterRole).toBe("seed");
    expect(rows[1]!.clusterRole).toBe("seed");
    expect(rows[0]!.clusterId).not.toBe(rows[1]!.clusterId);
  });

  it("expandKeywordTargetsForApi copies seed entityHint onto members when member hint is empty", () => {
    const rows = expandKeywordTargetsForApi([
      {
        id: "s1",
        keyword: "seed kw",
        entityHint: "Calgary",
        sapPages: 0,
        clusterId: "grp",
        clusterRole: "seed",
      },
      {
        id: "m1",
        keyword: "member kw",
        entityHint: "",
        sapPages: 5,
        clusterId: "grp",
        clusterRole: "member",
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.keyword).toBe("member kw");
    expect(rows[0]!.entityHint).toBe("Calgary");
    expect(rows[0]!.sapPages).toBe(5);
  });

  it("expandKeywordTargetsForApi keeps member entityHint when striping assigned one", () => {
    const rows = expandKeywordTargetsForApi([
      {
        id: "s1",
        keyword: "seed kw",
        entityHint: "Banff, AB",
        sapPages: 0,
        clusterId: "grp",
        clusterRole: "seed",
      },
      {
        id: "m1",
        keyword: "member kw",
        entityHint: "Canmore, AB",
        sapPages: 5,
        clusterId: "grp",
        clusterRole: "member",
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.entityHint).toBe("Canmore, AB");
  });

  it("stripeEntityHintsFromOrderedPool assigns distinct pool titles across members", () => {
    const rough = [
      {
        keyword: "seed kw",
        sapPages: 0,
        clusterId: "g",
        clusterRole: "seed" as const,
        entityHint: "A",
      },
      { keyword: "m1 kw", sapPages: 3, clusterId: "g", clusterRole: "member" as const },
      { keyword: "m2 kw", sapPages: 3, clusterId: "g", clusterRole: "member" as const },
    ];
    const out = stripeEntityHintsFromOrderedPool(rough, ["Place Alpha", "Place Beta", "Place Gamma"]);
    expect(out[1]!.entityHint).toBe("Place Alpha");
    expect(out[2]!.entityHint).toBe("Place Beta");
    expect(out[0]?.entityHint).toBe("A");
  });

  it("propagateSeedEntityHintsToMembers does not overwrite striped member hints", () => {
    const striped = [
      {
        keyword: "s",
        sapPages: 0,
        clusterId: "g",
        clusterRole: "seed" as const,
        entityHint: "Common seed",
      },
      {
        keyword: "m1",
        sapPages: 3,
        clusterId: "g",
        clusterRole: "member" as const,
        entityHint: "Place Alpha",
      },
      { keyword: "m2", sapPages: 3, clusterId: "g", clusterRole: "member" as const },
    ];
    const out = propagateSeedEntityHintsToMembers(striped);
    expect(out[1]?.entityHint).toBe("Place Alpha");
    expect(out[2]?.entityHint).toBe("Common seed");
  });

  it("seedRowIdForKeywordTarget resolves member to seed id", () => {
    const all = [
      { id: "seed-id", keyword: "x", entityHint: "E", sapPages: 1, clusterId: "g", clusterRole: "seed" as const },
      { id: "mem-id", keyword: "y", entityHint: "", sapPages: 1, clusterId: "g", clusterRole: "member" as const },
    ];
    expect(seedRowIdForKeywordTarget(all[1]!, all)).toBe("seed-id");
  });

  it("inheritKeywordTargetEntityHints leaves members without hint if seed has no hint", () => {
    const out = inheritKeywordTargetEntityHints([
      { id: "a", keyword: "s", entityHint: "", sapPages: 1, clusterId: "g", clusterRole: "seed" },
      { id: "b", keyword: "m", entityHint: "", sapPages: 1, clusterId: "g", clusterRole: "member" },
    ]);
    expect(out[1]!.entityHint).toBe("");
  });

  it("resolveClusterSeedEntityHint prefers member-own entityHint when set", () => {
    const rows = [
      { id: "s", keyword: "a", entityHint: "Seed place", sapPages: 0, clusterId: "g", clusterRole: "seed" as const },
      {
        id: "m",
        keyword: "b",
        entityHint: "Own member place",
        sapPages: 3,
        clusterId: "g",
        clusterRole: "member" as const,
      },
    ];
    expect(resolveClusterSeedEntityHint(rows, rows[1]!)).toBe("Own member place");
  });

  it("resolveClusterSeedEntityHint returns seed entityHint for members without own hint", () => {
    const rows = [
      { id: "s", keyword: "a", entityHint: "Northwest Cobb, GA", sapPages: 0, clusterId: "g", clusterRole: "seed" as const },
      { id: "m", keyword: "b", entityHint: "", sapPages: 3, clusterId: "g", clusterRole: "member" as const },
    ];
    expect(resolveClusterSeedEntityHint(rows, rows[1]!)).toBe("Northwest Cobb, GA");
    expect(resolveClusterSeedEntityHint(rows, rows[0]!)).toBe("Northwest Cobb, GA");
  });

  it("resolveClusterSeedEntityHint uses group order when member lacks clusterId", () => {
    const rows = [
      { id: "s", keyword: "a", entityHint: "Seed place", sapPages: 0, clusterId: "g", clusterRole: "seed" as const },
      { id: "m", keyword: "b", entityHint: "", sapPages: 2, clusterRole: "member" as const },
    ];
    expect(resolveClusterSeedEntityHint(rows, rows[1]!)).toBe("Seed place");
  });

  it("collapseRoughToSeedGroupsOnly rolls member SAP onto seed and drops members", () => {
    const rough = flattenClustersToRoughRows([
      {
        clusterId: "c1",
        seedKeyword: "local seo",
        wikiEntityHint: "Strathcona",
        sapPagesSeed: 6,
        members: [{ keyword: "seo strategy" }, { keyword: "on page seo" }],
      },
    ]);
    const seeds = collapseRoughToSeedGroupsOnly(rough);
    expect(seeds).toHaveLength(1);
    expect(seeds[0]).toMatchObject({
      keyword: "local seo",
      entityHint: "Strathcona",
      clusterRole: "seed",
      sapPages: 6,
    });
  });
});
