import type { LucideIcon } from "lucide-react";
import {
  Archive,
  BarChart3,
  Bot,
  Building2,
  Calendar,
  ClipboardCheck,
  Database,
  FilePen,
  FileSpreadsheet,
  Globe,
  HardDrive,
  LayoutGrid,
  ListChecks,
  Mail,
  Map,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { forgeClientColorUnique } from "@/lib/pulse-forge/forge-client-colors";
import type { WorkflowNode } from "@/lib/workflow/workflow-types";
import {
  isWorkflowClientKind,
  isWorkflowThenKind,
  isWorkflowTriggerKind,
} from "@/lib/workflow/workflow-types";

export type WorkflowStepIconSpec = {
  Icon: LucideIcon;
  className: string;
};

const THEN_ICON_CLASS = "h-4 w-4 text-[hsl(160_55%_58%)]";
const TRIGGER_ICON_CLASS = "h-4 w-4 text-[hsl(var(--semantic-warning))]";
const RAG_ICON_CLASS = "h-4 w-4 text-[hsl(var(--semantic-data))]";
const AGENT_ICON_CLASS = "h-4 w-4 text-primary";

function iconForExecutionKind(executionKind: string): WorkflowStepIconSpec {
  switch (executionKind) {
    case "content_optimizer":
    case "content_optimizer_meta":
      return { Icon: Sparkles, className: AGENT_ICON_CLASS };
    case "gsc_reporting":
      return { Icon: BarChart3, className: AGENT_ICON_CLASS };
    case "chatgpt_website_audit":
      return { Icon: Bot, className: AGENT_ICON_CLASS };
    case "dfs_llm_article_audit":
      return { Icon: ClipboardCheck, className: AGENT_ICON_CLASS };
    case "browser_automation":
      return { Icon: Globe, className: AGENT_ICON_CLASS };
    case "content_gap_check":
      return { Icon: ListChecks, className: AGENT_ICON_CLASS };
    case "post_creator":
      return { Icon: FilePen, className: AGENT_ICON_CLASS };
    case "entity_page_creator":
    case "entity_generator":
      return { Icon: Building2, className: AGENT_ICON_CLASS };
    case "sap_generator":
      return { Icon: LayoutGrid, className: AGENT_ICON_CLASS };
    case "local_dominator_export":
      return { Icon: Map, className: AGENT_ICON_CLASS };
    default:
      return { Icon: Zap, className: AGENT_ICON_CLASS };
  }
}

export function workflowStepIconForNode(
  node: WorkflowNode,
  primaryClientSiteId?: string,
): WorkflowStepIconSpec {
  if (isWorkflowClientKind(node.kind)) {
    const color = forgeClientColorUnique(primaryClientSiteId);
    return { Icon: Users, className: `h-4 w-4 ${color.textClass}` };
  }
  if (isWorkflowTriggerKind(node.kind)) {
    return { Icon: Calendar, className: TRIGGER_ICON_CLASS };
  }
  if (node.kind === "rag_archive") {
    return { Icon: Database, className: RAG_ICON_CLASS };
  }
  if (node.kind === "csv_rows") {
    return { Icon: FileSpreadsheet, className: AGENT_ICON_CLASS };
  }
  if (isWorkflowThenKind(node.kind)) {
    if (node.kind === "then_email") return { Icon: Mail, className: THEN_ICON_CLASS };
    if (node.kind === "then_google_drive") return { Icon: HardDrive, className: THEN_ICON_CLASS };
    if (node.kind === "then_local") return { Icon: Archive, className: THEN_ICON_CLASS };
    if (node.kind === "then_scheduled") return { Icon: Calendar, className: THEN_ICON_CLASS };
    if (node.kind === "then_draft") return { Icon: FilePen, className: THEN_ICON_CLASS };
    return { Icon: Zap, className: THEN_ICON_CLASS };
  }
  if (node.kind === "action_agent") {
    const executionKind = String(
      (node.config as { executionKind?: string }).executionKind ?? "",
    ).trim();
    return iconForExecutionKind(executionKind);
  }
  return { Icon: Zap, className: AGENT_ICON_CLASS };
}
