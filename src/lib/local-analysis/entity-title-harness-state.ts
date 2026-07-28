import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import type { LocalAnalysisHeaderProgress } from "@/lib/local-analysis/header-progress";
import {
  buildEntityTitleClusterJobsFromTargets,
  type EntityTitleClusterJob,
  type EntityTitleClusterKeywordTarget,
} from "@/lib/local-analysis/entity-sap-title-cluster-jobs";

export const ENTITY_HARNESS_PENDING_LOCATION = "Pending location…";

export type EntityTitleHarnessEntityStep = {
  rowIndex: number;
  entity: string;
  status: "waiting" | "generating" | "done";
  title?: string;
};

export type EntityTitleHarnessClusterGroup = {
  clusterKey: string;
  seedKeyword: string;
  status: "waiting" | "generating" | "done";
  entities: EntityTitleHarnessEntityStep[];
};

export function buildEntityTitleHarnessGroups(
  jobs: EntityTitleClusterJob[],
  sapRows: CSVRow[],
): EntityTitleHarnessClusterGroup[] {
  return jobs.map((job) => ({
    clusterKey: job.clusterKey,
    seedKeyword: job.seedKeyword,
    status: "waiting" as const,
    entities: job.rowIndices.map((rowIndex) => {
      const row = sapRows[rowIndex];
      const entity = (row?.entity ?? "").trim();
      return {
        rowIndex,
        entity: entity || `Row ${rowIndex + 1}`,
        status: "waiting" as const,
      };
    }),
  }));
}

export function buildEntityTitleHarnessGroupsFromTargets(
  keywordTargets: EntityTitleClusterKeywordTarget[],
  maxSapBudget: number,
): EntityTitleHarnessClusterGroup[] {
  const jobs = buildEntityTitleClusterJobsFromTargets(keywordTargets, maxSapBudget);
  return jobs.map((job) => ({
    clusterKey: job.clusterKey,
    seedKeyword: job.seedKeyword,
    status: "waiting" as const,
    entities: job.rowIndices.map((rowIndex) => ({
      rowIndex,
      entity: ENTITY_HARNESS_PENDING_LOCATION,
      status: "waiting" as const,
    })),
  }));
}

export function hydrateEntityTitleHarnessFromSapRows(
  groups: EntityTitleHarnessClusterGroup[],
  jobs: EntityTitleClusterJob[],
  sapRows: CSVRow[],
): EntityTitleHarnessClusterGroup[] {
  const jobByKey = new Map(jobs.map((j) => [j.clusterKey, j]));
  return groups.map((group) => {
    const job = jobByKey.get(group.clusterKey);
    if (!job) return group;
    const entityByRowIndex = new Map(
      job.rowIndices.map((rowIndex) => {
        const entity = (sapRows[rowIndex]?.entity ?? "").trim();
        return [rowIndex, entity || `Row ${rowIndex + 1}`] as const;
      }),
    );
    return {
      ...group,
      entities: job.rowIndices.map((rowIndex) => {
        const prev = group.entities.find((e) => e.rowIndex === rowIndex);
        return {
          rowIndex,
          entity: entityByRowIndex.get(rowIndex) ?? ENTITY_HARNESS_PENDING_LOCATION,
          status: prev?.status ?? ("waiting" as const),
          ...(prev?.title ? { title: prev.title } : {}),
        };
      }),
    };
  });
}

export function mergeEntityGenerateProgress(
  prev: LocalAnalysisHeaderProgress | null,
  patch: Partial<LocalAnalysisHeaderProgress>,
): LocalAnalysisHeaderProgress {
  const kind = patch.kind ?? prev?.kind ?? "generate";
  const base: LocalAnalysisHeaderProgress = {
    kind,
    phase: patch.phase ?? prev?.phase ?? "",
    completed: patch.completed ?? prev?.completed ?? 0,
    total: patch.total ?? prev?.total ?? 0,
    ...(prev?.progressPct !== undefined ? { progressPct: prev.progressPct } : {}),
    ...(patch.progressPct !== undefined ? { progressPct: patch.progressPct } : {}),
  };

  if (kind === "generate") {
    const titleHarnessGroups =
      patch.titleHarnessGroups ?? prev?.titleHarnessGroups;
    const harnessPlannedSectionCount =
      patch.harnessPlannedSectionCount ?? prev?.harnessPlannedSectionCount;
    return {
      ...base,
      ...(titleHarnessGroups ? { titleHarnessGroups } : {}),
      ...(harnessPlannedSectionCount !== undefined
        ? { harnessPlannedSectionCount }
        : {}),
    };
  }

  return { ...base, ...patch };
}

export function applyClusterHarnessPhase(
  groups: EntityTitleHarnessClusterGroup[],
  clusterIndex: number,
  phase: "start" | "done",
  titlesByRowIndex?: Map<number, string>,
): EntityTitleHarnessClusterGroup[] {
  if (clusterIndex < 0 || clusterIndex >= groups.length) return groups;

  return groups.map((group, i) => {
    if (i !== clusterIndex) return group;

    if (phase === "start") {
      return {
        ...group,
        status: "generating" as const,
        entities: group.entities.map((step) => ({
          ...step,
          status: "generating" as const,
        })),
      };
    }

    return {
      ...group,
      status: "done" as const,
      entities: group.entities.map((step) => {
        const title = titlesByRowIndex?.get(step.rowIndex)?.trim();
        return {
          ...step,
          status: "done" as const,
          ...(title ? { title } : {}),
        };
      }),
    };
  });
}

export function countEntityHarnessSteps(groups: EntityTitleHarnessClusterGroup[]): {
  done: number;
  total: number;
} {
  let done = 0;
  let total = 0;
  for (const group of groups) {
    for (const step of group.entities) {
      total += 1;
      if (step.status === "done") done += 1;
    }
  }
  return { done, total };
}

export function titlesMapFromRows(rows: CSVRow[], rowIndices: number[]): Map<number, string> {
  const map = new Map<number, string>();
  for (const idx of rowIndices) {
    const title = rows[idx]?.title?.trim();
    if (title) map.set(idx, title);
  }
  return map;
}
