import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ClipboardCheck,
  Ellipsis,
  FileText,
  Globe,
  LayoutGrid,
  Newspaper,
  PenLine,
  Search,
  Tags,
} from "lucide-react";
import {
  AGENT_RUN_BUCKET_ORDER,
  type AgentRunBucketKey,
} from "@/lib/agent-runs/agent-run-grouping";
import { TASK_EXECUTION_TARGET_BUCKET_LABELS } from "@/lib/task-execution-bucket";

/** Buckets shown in the agent sidebar icon rail (stable order). */
export const AGENT_RUN_SIDEBAR_BUCKET_KEYS: AgentRunBucketKey[] = AGENT_RUN_BUCKET_ORDER;

const RECIPE_BUCKET_LABELS: Partial<Record<AgentRunBucketKey, string>> = {
  reporting: "Reporting",
  research: "Research",
  dfs_llm_article_audit: "Article audit",
  editorial: "Editorial",
  meta: "Meta",
  other: "Other",
};

export function agentRunBucketLabel(key: AgentRunBucketKey): string {
  if (key in TASK_EXECUTION_TARGET_BUCKET_LABELS) {
    return TASK_EXECUTION_TARGET_BUCKET_LABELS[key as keyof typeof TASK_EXECUTION_TARGET_BUCKET_LABELS];
  }
  return RECIPE_BUCKET_LABELS[key] ?? key;
}

export function agentRunBucketIcon(key: AgentRunBucketKey): LucideIcon {
  switch (key) {
    case "reporting":
      return BarChart3;
    case "research":
      return Search;
    case "dfs_llm_article_audit":
      return ClipboardCheck;
    case "editorial":
      return PenLine;
    case "meta":
      return Tags;
    case "pages":
      return FileText;
    case "posts":
      return Newspaper;
    case "sap":
      return LayoutGrid;
    case "all":
      return Globe;
    default:
      return Ellipsis;
  }
}

export function agentRunBucketTooltipLabel(
  key: AgentRunBucketKey,
  count: number,
  activeCount = 0,
): string {
  const base = `${agentRunBucketLabel(key)} (${count})`;
  if (activeCount > 0) {
    return `${base} · ${activeCount} running`;
  }
  return base;
}

/** Default sidebar tab when a client has no runs in any bucket. */
export const AGENT_RUN_SIDEBAR_DEFAULT_BUCKET: AgentRunBucketKey = "reporting";
