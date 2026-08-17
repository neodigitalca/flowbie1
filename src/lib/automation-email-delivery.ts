import { buildAutomationEmailIntro } from "@/lib/automation-email-intro";
import {
  formatGscMeetingScriptMarkdown,
  gscMeetingScriptFile,
} from "@/lib/gsc-reporting/gsc-reporting-meeting-script-markdown";
import { resolveOpenRouterApiKeyForHarness } from "@/lib/openrouter-api-key-resolve";
import { sendTeamMail } from "@/lib/teams-api";
import { patchTaskExecutionProgress } from "@/lib/tasks-api";
import type { AgentRun } from "@/lib/agent-runs-types";
import type { TaskArchiveFileInput } from "@/lib/task-execution-archive";
import type { TaskExecutionClientRunContract, TaskExecutionKind } from "@/lib/tasks-types";

export type AutomationEmailTokenContext = {
  siteName: string;
  automationTitle: string;
  executionKind: TaskExecutionKind;
  compareLabel?: string;
  comparePreset?: "mom" | "yoy";
  summary?: string;
  attachmentDateStamp?: number;
};

export type AutomationEmailDeliveryResult = {
  emailSent?: boolean;
  emailError?: string;
  emailSkipped?: boolean;
  emailSkipReason?: string;
  transport?: string;
  meetingScriptFile?: TaskArchiveFileInput;
};

type EmailStepStatus = "running" | "done" | "error";

const ARCHIVE_FOOTER = "Full run output is saved in your team archive in Neo Pulse.";
const ATTACHMENT_FOOTER = "The final report is attached to this email.";
const GSC_ATTACHMENTS_FOOTER = "Meeting notes and final report are attached to this email.";

export function automationTitleFromRun(run: AgentRun): string {
  return (
    String(run.recipeTitle ?? run.title ?? run.taskTitle ?? "Automation").trim() || "Automation"
  );
}

export function executionKindFromRun(run: AgentRun): TaskExecutionKind {
  const recipe = String(run.recipeKey ?? "");
  if (recipe === "gsc_reporting") return "gsc_reporting";
  if (recipe === "post_creator") return "post_creator";
  if (recipe === "overview_pages_meta_batch") return "content_optimizer_meta";
  if (recipe === "content_optimizer_bulk") return "content_optimizer";
  return "";
}

function formatDateToken(): string {
  return new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function resolveAutomationEmailTokens(
  template: string,
  ctx: AutomationEmailTokenContext,
): string {
  const kindLabel = ctx.executionKind.replace(/_/g, " ").trim();
  return template
    .split("{siteName}")
    .join(ctx.siteName)
    .split("{automationTitle}")
    .join(ctx.automationTitle)
    .split("{date}")
    .join(formatDateToken())
    .split("{executionKind}")
    .join(kindLabel)
    .split("{compareLabel}")
    .join(ctx.compareLabel ?? "")
    .split("{summary}")
    .join(ctx.summary ?? "");
}

function defaultSubject(ctx: AutomationEmailTokenContext): string {
  return resolveAutomationEmailTokens(
    "{siteName} automation summary ({date})",
    ctx,
  );
}

function composeEmailBody(
  intro: string,
  bullets: string[],
  footer: string,
  bulletHeading = "Highlights:",
): string {
  const lines = [intro.trim()];
  if (bullets.length > 0) {
    lines.push("", bulletHeading);
    for (const item of bullets) {
      lines.push(`- ${item}`);
    }
  }
  lines.push("", footer);
  return lines.join("\n");
}

function composeGscTeaserEmailBody(previewPoints: string[]): string {
  const opener =
    "Use the attached meeting notes in your client call. The GSC report is attached for backup detail.";
  const preview = previewPoints.slice(0, 3);
  return composeEmailBody(opener, preview, GSC_ATTACHMENTS_FOOTER, "Quick preview:");
}

function composeStaticEmailBody(
  contract: TaskExecutionClientRunContract,
  ctx: AutomationEmailTokenContext,
  hasAttachments: boolean,
): string {
  const staticMessage = String(contract.automationEmailMessage ?? "").trim();
  const opener =
    staticMessage ||
    resolveAutomationEmailTokens(
      "Hi, your {automationTitle} run for {siteName} is complete.",
      ctx,
    );
  return composeEmailBody(
    opener,
    ctx.summary ? [ctx.summary] : [],
    hasAttachments ? ATTACHMENT_FOOTER : ARCHIVE_FOOTER,
  );
}

async function resolveEmailSubjectAndBody(args: {
  contract: TaskExecutionClientRunContract;
  tokenContext: AutomationEmailTokenContext;
  summaryText: string;
  hasReportAttachment: boolean;
}): Promise<{
  subject: string;
  body: string;
  meetingScriptFile?: TaskArchiveFileInput;
}> {
  const subjectTemplate = String(args.contract.automationEmailSubject ?? "").trim();
  let subject = subjectTemplate
    ? resolveAutomationEmailTokens(subjectTemplate, args.tokenContext)
    : defaultSubject(args.tokenContext);

  if (args.contract.automationEmailAiIntro) {
    try {
      const apiKey = (await resolveOpenRouterApiKeyForHarness()).trim();
      if (apiKey) {
        const intro = await buildAutomationEmailIntro({
          apiKey,
          executionKind: args.tokenContext.executionKind,
          siteName: args.tokenContext.siteName,
          automationTitle: args.tokenContext.automationTitle,
          summaryText: args.summaryText,
          compareLabel: args.tokenContext.compareLabel,
        });
        if (intro.subject?.trim()) {
          subject = resolveAutomationEmailTokens(intro.subject.trim(), args.tokenContext);
        }

        if (args.tokenContext.executionKind === "gsc_reporting") {
          const comparePreset = args.tokenContext.comparePreset ?? "mom";
          const dateStamp = args.tokenContext.attachmentDateStamp ?? Date.now();
          const scriptMarkdown = formatGscMeetingScriptMarkdown({
            siteName: args.tokenContext.siteName,
            compareLabel: args.tokenContext.compareLabel,
            comparePreset,
            highlights: intro.highlights,
            talkingPoints: intro.talkingPoints ?? intro.highlights,
            clientQuestions: intro.clientQuestions ?? [],
          });
          const meetingScriptFile = gscMeetingScriptFile({
            siteName: args.tokenContext.siteName,
            comparePreset,
            content: scriptMarkdown,
            dateStamp,
          });
          return {
            subject,
            body: composeGscTeaserEmailBody(intro.highlights),
            meetingScriptFile,
          };
        }

        return {
          subject,
          body: composeEmailBody(
            intro.intro,
            intro.highlights,
            args.hasReportAttachment ? ATTACHMENT_FOOTER : ARCHIVE_FOOTER,
            intro.bulletHeading,
          ),
        };
      }
    } catch {
      /* fall back to static intro below */
    }
  }

  return {
    subject,
    body: composeStaticEmailBody(args.contract, args.tokenContext, args.hasReportAttachment),
  };
}

export async function sendAutomationEmailIfConfigured(args: {
  teamId: number;
  executionId: number;
  contract: TaskExecutionClientRunContract | Record<string, unknown>;
  tokenContext: AutomationEmailTokenContext;
  summaryText: string;
  attachments?: TaskArchiveFileInput[];
  runOk?: boolean;
  onStep?: (label: string, status?: EmailStepStatus) => void | Promise<void>;
}): Promise<AutomationEmailDeliveryResult> {
  const reportStep = async (label: string, status: EmailStepStatus = "running") => {
    await args.onStep?.(label, status);
  };

  if (args.runOk === false) {
    await reportStep("Email skipped (run failed)", "error");
    return {
      emailSkipped: true,
      emailSkipReason: "Run did not complete successfully.",
    };
  }

  const contract = args.contract as TaskExecutionClientRunContract;
  if (!contract.sendAutomationEmail) {
    await reportStep("Email skipped (not configured on run)", "done");
    return {
      emailSkipped: true,
      emailSkipReason: "sendAutomationEmail not set on run contract.",
    };
  }

  const to = String(contract.automationEmailTo ?? "").trim();
  if (!to) {
    await reportStep("Email failed (recipient required)", "error");
    return { emailSent: false, emailError: "Recipient email is required." };
  }

  await reportStep("Sending email…", "running");
  await patchTaskExecutionProgress(args.teamId, args.executionId, {
    message: "Sending email…",
    progress: 0.98,
  });

  let subject: string;
  let body: string;
  let meetingScriptFile: TaskArchiveFileInput | undefined;
  const reportAttachments = (args.attachments ?? []).filter(
    (file) => file.fileName.trim() && file.content.trim(),
  );
  try {
    const resolved = await resolveEmailSubjectAndBody({
      contract,
      tokenContext: args.tokenContext,
      summaryText: args.summaryText,
      hasReportAttachment: reportAttachments.length > 0,
    });
    subject = resolved.subject;
    body = resolved.body;
    meetingScriptFile = resolved.meetingScriptFile;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Email compose failed.";
    await reportStep(`Email failed (${message})`, "error");
    return { emailSent: false, emailError: message };
  }

  const attachments = [
    ...(meetingScriptFile ? [meetingScriptFile] : []),
    ...reportAttachments,
  ];

  const mail = await sendTeamMail(args.teamId, {
    to,
    subject,
    message: body,
    attachments,
  });
  if (!mail.ok) {
    const message = mail.error ?? "Email send failed.";
    await reportStep(`Email failed (${message})`, "error");
    return { emailSent: false, emailError: message, transport: mail.transport };
  }

  await reportStep("Email sent", "done");
  return {
    emailSent: true,
    transport: mail.transport,
    ...(meetingScriptFile ? { meetingScriptFile } : {}),
  };
}
