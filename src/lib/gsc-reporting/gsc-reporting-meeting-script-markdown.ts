import type { TaskArchiveFileInput } from "@/lib/task-execution-archive";

export type GscClientQuestion = {
  question: string;
  answer: string;
};

export type GscMeetingNotesMarkdownInput = {
  siteName: string;
  compareLabel?: string;
  comparePreset: "mom" | "yoy";
  highlights: string[];
  talkingPoints: string[];
  clientQuestions: GscClientQuestion[];
  preparedDate?: Date;
};

const SECTION_RULE = "---";

function siteSlug(siteName: string): string {
  return siteName.replace(/\s+/g, "-").replace(/[^\w-]/g, "").toLowerCase() || "site";
}

function comparePresetLabel(preset: "mom" | "yoy"): string {
  return preset === "yoy" ? "Year over Year" : "Month over Month";
}

function formatPreparedDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function bulletList(items: string[]): string[] {
  if (items.length === 0) return [];
  return items.map((item) => `- ${item.trim()}`).filter((line) => line.length > 2);
}

function renderClientQuestions(questions: GscClientQuestion[]): string[] {
  if (questions.length === 0) return [];
  const lines: string[] = ["## If the client asks", ""];
  for (const entry of questions) {
    const question = entry.question.trim();
    const answer = entry.answer.trim();
    if (!question) continue;
    lines.push(`**${question}**`);
    if (answer) {
      lines.push("", answer, "");
    } else {
      lines.push("");
    }
  }
  return lines;
}

export function formatGscMeetingScriptMarkdown(input: GscMeetingNotesMarkdownInput): string {
  const prepared = input.preparedDate ?? new Date();
  const compareLine = input.compareLabel?.trim() || comparePresetLabel(input.comparePreset);

  const lines: string[] = [
    "# Client meeting notes",
    "",
    `## ${input.siteName} | Google Search Console (${comparePresetLabel(input.comparePreset)})`,
    "",
    `**Prepared:** ${formatPreparedDate(prepared)}  `,
    `**Compare period:** ${compareLine}`,
    "",
    SECTION_RULE,
    "",
    "## Highlights",
    "",
    ...bulletList(input.highlights),
    "",
    SECTION_RULE,
    "",
    "## Talking points",
    "",
    ...bulletList(input.talkingPoints),
    "",
    SECTION_RULE,
    "",
    ...renderClientQuestions(input.clientQuestions),
  ];

  if (input.clientQuestions.length > 0) {
    lines.push(SECTION_RULE, "");
  }

  lines.push(
    "## Reference",
    "",
    "Full metrics and page-level detail are in the attached GSC report.",
    "",
  );

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export function gscMeetingScriptFile(input: {
  siteName: string;
  comparePreset: "mom" | "yoy";
  content: string;
  dateStamp?: number;
}): TaskArchiveFileInput {
  const stamp = input.dateStamp ?? Date.now();
  const presetTag = input.comparePreset === "yoy" ? "yoy" : "mom";
  return {
    fileName: `gsc-meeting-notes-${presetTag}-${siteSlug(input.siteName)}-${stamp}.md`,
    mime: "text/markdown",
    content: input.content.trim(),
  };
}
