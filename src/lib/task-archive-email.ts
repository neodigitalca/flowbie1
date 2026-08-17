import {
  resolveAutomationEmailTokens,
  type AutomationEmailTokenContext,
} from "@/lib/automation-email-delivery";
import { sendTeamMail } from "@/lib/teams-api";
import type { TaskExecutionKind, TaskExecutionPayload, TaskFile } from "@/lib/tasks-types";

function markdownFileFromRun(files: TaskFile[]): TaskFile | undefined {
  return files.find((file) => file.fileName.toLowerCase().endsWith(".md"));
}

function archiveRunSummaryLabel(files: TaskFile[]): string {
  const markdown = markdownFileFromRun(files);
  if (!markdown) return "Archived run summary";
  const name = markdown.fileName.toLowerCase();
  if (name.includes("gsc-report-mom-")) return "GSC MoM report";
  if (name.includes("gsc-report-yoy-")) return "GSC YoY report";
  return markdown.fileName.replace(/\.md$/i, "");
}

export async function sendArchiveRunEmail(args: {
  teamId: number;
  summaryText: string;
  files: TaskFile[];
  executionPayload: TaskExecutionPayload;
  executionKind?: TaskExecutionKind;
  automationTitle?: string;
  siteName?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const to = String(args.executionPayload.automationEmailTo ?? "").trim();
  if (!to) {
    return { ok: false, error: "Set a recipient on the Then tab first." };
  }

  const tokenContext: AutomationEmailTokenContext = {
    siteName: args.siteName?.trim() || "Your site",
    automationTitle: args.automationTitle?.trim() || "Automation",
    executionKind: args.executionKind ?? "",
    summary: archiveRunSummaryLabel(args.files),
  };

  const subjectTemplate = String(args.executionPayload.automationEmailSubject ?? "").trim();
  const subject = subjectTemplate
    ? resolveAutomationEmailTokens(subjectTemplate, tokenContext)
    : resolveAutomationEmailTokens("{siteName} automation summary ({date})", tokenContext);

  const staticMessage = String(args.executionPayload.automationEmailMessage ?? "").trim();
  const opener =
    staticMessage ||
    resolveAutomationEmailTokens(
      "Hi, your {automationTitle} run for {siteName} is complete.",
      tokenContext,
    );

  const summary = args.summaryText.trim();
  const fileNames = args.files.map((file) => file.fileName).filter(Boolean);
  const lines = [opener.trim(), "", "Summary:", summary];
  if (fileNames.length > 0) {
    lines.push("", "Archived files:", ...fileNames.map((name) => `- ${name}`));
  }

  const mail = await sendTeamMail(args.teamId, {
    to,
    subject,
    message: lines.join("\n"),
  });

  if (!mail.ok) {
    return { ok: false, error: mail.error ?? "Email send failed." };
  }
  return { ok: true };
}
