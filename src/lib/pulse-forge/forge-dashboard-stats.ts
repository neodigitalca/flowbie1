import type { AgentRun } from "@/lib/agent-runs-types";
import { isAgentRunTerminal } from "@/lib/agent-runs-types";
import type { TaskProject } from "@/lib/tasks-types";
import type { TaskProjectBundle } from "@/contexts/TeamContext";
import {
  activeRunForProject,
  filterForgeAgentRuns,
} from "@/lib/pulse-forge/forge-dashboard-runs";
import type {
  ForgeDashboardChartPoint,
  ForgeDashboardHeroCard,
  ForgeDashboardRankedRow,
  ForgeDashboardSnapshot,
} from "@/lib/pulse-forge/forge-dashboard-demo-data";

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`;
}

function runDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function chartDayLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function lastNDayKeys(days: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    keys.push(runDayKey(d.toISOString()));
  }
  return keys;
}

function recipeChartKey(recipeKey: string): string {
  const normalized = recipeKey.trim() || "other";
  return normalized.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 24);
}

function recipeLabel(recipeKey: string, recipeTitle?: string): string {
  if (recipeTitle?.trim()) return recipeTitle.trim();
  return recipeKey.replace(/_/g, " ");
}

function projectChartKey(projectId: number): string {
  return `p_${projectId}`;
}

function buildBucketSeries(
  runs: AgentRun[],
  dayKeys: string[],
  segmentKeys: string[],
  segmentForRun: (run: AgentRun) => string | null,
): ForgeDashboardChartPoint[] {
  const bucket = new Map<string, Record<string, number>>();
  for (const key of dayKeys) {
    const row: Record<string, number> = {};
    for (const sk of segmentKeys) row[sk] = 0;
    bucket.set(key, row);
  }
  for (const run of runs) {
    const segment = segmentForRun(run);
    if (!segment || !segmentKeys.includes(segment)) continue;
    const day = runDayKey(run.createdAt);
    const row = bucket.get(day);
    if (!row) continue;
    row[segment] = (row[segment] ?? 0) + 1;
  }
  return dayKeys.map((key) => {
    const row = bucket.get(key) ?? {};
    const point: ForgeDashboardChartPoint = { date: chartDayLabel(`${key}T12:00:00.000Z`) };
    for (const sk of segmentKeys) point[sk] = row[sk] ?? 0;
    return point;
  });
}

function topRecipeLegend(
  runs: AgentRun[],
  limit = 3,
): { keys: string[]; legend: { id: string; label: string; value: string }[] } {
  const counts = new Map<string, { label: string; count: number }>();
  for (const run of runs) {
    const id = recipeChartKey(run.recipeKey);
    const existing = counts.get(id);
    if (existing) existing.count += 1;
    else counts.set(id, { label: recipeLabel(run.recipeKey, run.recipeTitle), count: 1 });
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, limit);
  return {
    keys: sorted.map(([id]) => id),
    legend: sorted.map(([id, { label, count }]) => ({
      id,
      label,
      value: `${formatCount(count)} runs`,
    })),
  };
}

export function buildForgeDashboardLiveStats(
  runs: AgentRun[],
  automationProjects: TaskProject[],
  projectBundles: Record<number, TaskProjectBundle>,
): ForgeDashboardSnapshot {
  const forgeRuns = filterForgeAgentRuns(runs, automationProjects, projectBundles);
  const done = forgeRuns.filter((r) => r.status === "done").length;
  const failed = forgeRuns.filter((r) => r.status === "failed").length;
  const terminal = done + failed;
  const successRate = terminal > 0 ? (done / terminal) * 100 : 0;

  const recipeLegend = topRecipeLegend(forgeRuns);
  const miniDayKeys = lastNDayKeys(7);
  const miniSeries = buildBucketSeries(
    forgeRuns,
    miniDayKeys,
    recipeLegend.keys,
    (run) => recipeChartKey(run.recipeKey),
  );

  const heroCards: ForgeDashboardHeroCard[] = [
    {
      key: "spend",
      label: "Spend",
      value: "—",
      deltaPercent: null,
      deltaPositive: true,
      miniSeries,
      miniKeys: recipeLegend.keys,
      legend: recipeLegend.legend.map((item) => ({ ...item, value: "—" })),
      footnote: "Blended $/1M: —",
    },
    {
      key: "runs",
      label: "Requests",
      value: formatCount(forgeRuns.length),
      deltaPercent: null,
      deltaPositive: true,
      miniSeries,
      miniKeys: recipeLegend.keys,
      legend: recipeLegend.legend,
      footnote: terminal > 0 ? `Success rate: ${formatPercent(successRate)}` : "Success rate: —",
    },
    {
      key: "tokens",
      label: "Tokens",
      value: "—",
      deltaPercent: null,
      deltaPositive: true,
      miniSeries,
      miniKeys: recipeLegend.keys,
      legend: recipeLegend.legend.map((item) => ({ ...item, value: "—" })),
    },
  ];

  const modelCounts = new Map<string, { label: string; count: number }>();
  for (const run of forgeRuns) {
    const key = recipeChartKey(run.recipeKey);
    const existing = modelCounts.get(key);
    if (existing) existing.count += 1;
    else modelCounts.set(key, { label: recipeLabel(run.recipeKey, run.recipeTitle), count: 1 });
  }

  const topModels: ForgeDashboardRankedRow[] = [...modelCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([id, { label, count }]) => ({
      id,
      title: label,
      value: `${formatCount(count)} runs`,
      active: forgeRuns.some(
        (r) => recipeChartKey(r.recipeKey) === id && !isAgentRunTerminal(r.status),
      ),
    }));

  const projectRunCounts = new Map<number, { count: number; lastAt: string }>();
  for (const run of forgeRuns) {
    const projectId = run.context?.projectId;
    if (projectId == null) continue;
    const existing = projectRunCounts.get(projectId);
    if (!existing) projectRunCounts.set(projectId, { count: 1, lastAt: run.createdAt });
    else {
      existing.count += 1;
      if (run.createdAt > existing.lastAt) existing.lastAt = run.createdAt;
    }
  }

  const agentRankings: ForgeDashboardRankedRow[] = automationProjects
    .map((project) => {
      const stats = projectRunCounts.get(project.id);
      const activeRun = activeRunForProject(runs, project.id, projectBundles);
      return {
        project,
        count: stats?.count ?? 0,
        lastAt: stats?.lastAt ?? project.updatedAt ?? project.createdAt ?? "",
        active: activeRun != null,
        status: activeRun ? "Running" : "Idle",
      };
    })
    .sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt))
    .slice(0, 5)
    .map(({ project, count, active, status }) => ({
      id: String(project.id),
      title: project.title,
      meta: status,
      value: `${formatCount(count)} runs`,
      active,
      projectId: project.id,
    }));

  const chartKeys = [...new Set(forgeRuns.map((r) => recipeChartKey(r.recipeKey)))].slice(0, 5);
  const dayKeys30 = lastNDayKeys(30);
  const chartSeries = buildBucketSeries(
    forgeRuns,
    dayKeys30,
    chartKeys,
    (run) => recipeChartKey(run.recipeKey),
  );

  const agentChartKeys = [...projectRunCounts.keys()]
    .sort((a, b) => (projectRunCounts.get(b)?.count ?? 0) - (projectRunCounts.get(a)?.count ?? 0))
    .slice(0, 5)
    .map(projectChartKey);

  const agentChartSeries = buildBucketSeries(
    forgeRuns,
    dayKeys30,
    agentChartKeys,
    (run) => {
      const projectId = run.context?.projectId;
      return projectId != null ? projectChartKey(projectId) : null;
    },
  );

  return {
    heroCards,
    topModels,
    agentRankings,
    chartKeys,
    chartSeries,
    agentChartKeys,
    agentChartSeries,
  };
}

export function agentChartLabels(
  agentChartKeys: string[],
  automationProjects: TaskProject[],
): Record<string, string> {
  const byId = new Map(automationProjects.map((p) => [projectChartKey(p.id), p.title]));
  const labels: Record<string, string> = {};
  for (const key of agentChartKeys) labels[key] = byId.get(key) ?? key.replace(/^p_/, "Agent ");
  return labels;
}
