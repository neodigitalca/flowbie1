import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import type { GscClientQuestion } from "@/lib/gsc-reporting/gsc-reporting-meeting-script-markdown";
import type { TaskExecutionKind } from "@/lib/tasks-types";

export type AutomationEmailIntroResult = {
  intro: string;
  highlights: string[];
  subject?: string;
  bulletHeading?: string;
  talkingPoints?: string[];
  clientQuestions?: GscClientQuestion[];
};

const GSC_MEETING_BULLET_HEADING = "Quick preview:";

function parseStringList(raw: unknown, maxItems: number): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0)
    .slice(0, maxItems);
}

function parseClientQuestions(raw: unknown, maxItems: number): GscClientQuestion[] {
  if (!Array.isArray(raw)) return [];
  const out: GscClientQuestion[] = [];
  for (const item of raw) {
    if (typeof item === "string") {
      const trimmed = item.trim();
      if (!trimmed) continue;
      const splitAt = trimmed.indexOf("?");
      if (splitAt > 0 && splitAt < trimmed.length - 1) {
        out.push({
          question: trimmed.slice(0, splitAt + 1).trim(),
          answer: trimmed.slice(splitAt + 1).trim(),
        });
      } else {
        out.push({ question: trimmed, answer: "" });
      }
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const record = item as { question?: unknown; answer?: unknown };
    const question = typeof record.question === "string" ? record.question.trim() : "";
    const answer = typeof record.answer === "string" ? record.answer.trim() : "";
    if (question) out.push({ question, answer });
    if (out.length >= maxItems) break;
  }
  return out;
}

function parseIntroJson(raw: string, executionKind: TaskExecutionKind): AutomationEmailIntroResult {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  const slice =
    jsonStart >= 0 && jsonEnd > jsonStart ? trimmed.slice(jsonStart, jsonEnd + 1) : trimmed;
  const parsed = JSON.parse(slice) as {
    intro?: unknown;
    highlights?: unknown;
    meetingPoints?: unknown;
    talkingPoints?: unknown;
    clientQuestions?: unknown;
    subject?: unknown;
  };
  const intro = typeof parsed.intro === "string" ? parsed.intro.trim() : "";
  const subject = typeof parsed.subject === "string" ? parsed.subject.trim() : undefined;
  if (!intro) {
    throw new Error("OpenRouter email intro missing intro text.");
  }

  const isGsc = executionKind === "gsc_reporting";
  if (isGsc) {
    const highlights = parseStringList(parsed.highlights, 6);
    const talkingPoints =
      parseStringList(parsed.talkingPoints, 10).length > 0
        ? parseStringList(parsed.talkingPoints, 10)
        : parseStringList(parsed.meetingPoints, 10);
    const clientQuestions = parseClientQuestions(parsed.clientQuestions, 6);
    const previewHighlights =
      highlights.length > 0 ? highlights : talkingPoints.slice(0, 3);
    return {
      intro,
      highlights: previewHighlights,
      talkingPoints,
      clientQuestions,
      subject,
      bulletHeading: GSC_MEETING_BULLET_HEADING,
    };
  }

  return {
    intro,
    highlights: parseStringList(parsed.highlights, 5),
    subject,
  };
}

function buildIntroSystemPrompt(executionKind: TaskExecutionKind): string {
  if (executionKind === "gsc_reporting") {
    return [
      "ROLE: You prepare client meeting notes for a marketing lead before a Google Search Console review.",
      "AUDIENCE: The lead presents to the business owner. Write prep notes, not a word-for-word script.",
      "Return JSON only with keys:",
      "intro (1 short sentence for the email teaser),",
      "highlights (3-5 short stat or theme bullets from the report),",
      "talkingPoints (6-10 discussion notes: what to cover, opportunities, context; do NOT write dialogue or lines starting with Say:),",
      "clientQuestions (4-6 objects with question and answer: likely client questions and concise answers grounded in the report),",
      "subject (optional short email subject).",
      "FORBIDDEN: verbatim script lines, stage directions, timing estimates, or telling the lead exactly what to say word for word.",
      "Ground everything in the report summary. Do not invent metrics, pages, or queries. No markdown. No em dashes.",
    ].join(" ");
  }

  return [
    "You write concise email copy for a marketing lead receiving an automation run summary.",
    "Return JSON only with keys: intro (2-4 conversational sentences), highlights (3-5 short bullet strings), subject (optional short subject line).",
    "Sound human and direct. No markdown. No em dashes.",
  ].join(" ");
}

function summaryLimitForKind(executionKind: TaskExecutionKind): number {
  return executionKind === "gsc_reporting" ? 14_000 : 6_000;
}

function maxTokensForKind(executionKind: TaskExecutionKind): number {
  return executionKind === "gsc_reporting" ? 2_000 : 900;
}

export async function buildAutomationEmailIntro(args: {
  apiKey: string;
  executionKind: TaskExecutionKind;
  siteName: string;
  automationTitle: string;
  summaryText: string;
  compareLabel?: string;
  signal?: AbortSignal;
}): Promise<AutomationEmailIntroResult> {
  const kindLabel = args.executionKind.replace(/_/g, " ").trim() || "automation";
  const compareLine = args.compareLabel?.trim()
    ? `Compare period: ${args.compareLabel.trim()}`
    : "";

  const user = [
    `Automation type: ${kindLabel}`,
    `Site: ${args.siteName}`,
    `Automation title: ${args.automationTitle}`,
    compareLine,
    "",
    "Run summary:",
    args.summaryText.slice(0, summaryLimitForKind(args.executionKind)),
  ]
    .filter(Boolean)
    .join("\n");

  const { content } = await callOpenRouterChatCompletion({
    apiKey: args.apiKey,
    model: getResearchModel(),
    system: buildIntroSystemPrompt(args.executionKind),
    user,
    maxTokens: maxTokensForKind(args.executionKind),
    temperature: 0.4,
    responseFormat: { type: "json_object" },
    signal: args.signal,
  });

  return parseIntroJson(content, args.executionKind);
}

export { GSC_MEETING_BULLET_HEADING };
