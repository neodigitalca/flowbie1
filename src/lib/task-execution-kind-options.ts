import type { TaskExecutionKind } from "@/lib/tasks-types";

export const TASK_EXECUTION_KIND_OPTIONS: { value: TaskExecutionKind; label: string }[] = [
  { value: "content_optimizer", label: "Content optimizer" },
  { value: "content_optimizer_meta", label: "Meta optimizer only" },
  { value: "gsc_reporting", label: "GSC reporting" },
  { value: "local_dominator_export", label: "Research export" },
  { value: "post_creator", label: "Post creator" },
];
