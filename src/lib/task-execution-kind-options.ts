import type { TaskExecutionKind } from "@/lib/tasks-types";

export const TASK_EXECUTION_KIND_OPTIONS: { value: TaskExecutionKind; label: string }[] = [
  { value: "content_optimizer", label: "Content optimizer" },
  { value: "content_optimizer_meta", label: "Meta optimizer only" },
  { value: "gsc_reporting", label: "GSC reporting" },
  { value: "local_dominator_export", label: "Research export" },
  { value: "chatgpt_website_audit", label: "ChatGPT website audit" },
  { value: "dfs_llm_article_audit", label: "DFS LLM article audit" },
  { value: "browser_automation", label: "Residential browser automation" },
  { value: "content_gap_check", label: "Content gap check" },
  { value: "post_creator", label: "Post creator" },
  { value: "entity_page_creator", label: "Entity page creator" },
  { value: "entity_generator", label: "Entity generator" },
  { value: "sap_generator", label: "SAP generator" },
];
