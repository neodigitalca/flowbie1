/**
 * OpenRouter agent: one short intro paragraph for the visible FAQ table section.
 */

import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getProductionModel } from "@/lib/optimization-settings-storage";
import type { FaqEntry } from "@/lib/faq-entries";

const SYSTEM = `You write a single short introductory paragraph for an FAQ section on a blog post.

Rules:
- Output plain text only: one or two sentences. No HTML, markdown, headings, bullets, or labels.
- Introduce the FAQ table that follows; do not answer the questions yourself.
- Weave the focus keyword naturally when provided.
- Sound editorial and on-topic for the page title and questions.
- Do not invent brand names, URLs, or facts not implied by the inputs.
- Do not start with "FAQ" or "Frequently Asked Questions".`;

function stripWrappingQuotes(text: string): string {
  let t = text.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

/** Normalize model output to a single intro paragraph (plain text). */
export function normalizeFaqIntroPlainText(raw: string): string {
  let t = (raw ?? "").trim();
  if (!t) return "";
  // Drop accidental HTML tags without regex branching on content meaning.
  let plain = "";
  let inTag = false;
  for (const ch of t) {
    if (ch === "<") {
      inTag = true;
      continue;
    }
    if (ch === ">") {
      inTag = false;
      continue;
    }
    if (!inTag) plain += ch;
  }
  t = plain.replace(/\s+/g, " ").trim();
  t = stripWrappingQuotes(t);
  return t;
}

export async function generateFaqIntroParagraph(args: {
  apiKey: string;
  model?: string;
  focusKeyword?: string;
  pageTitle?: string;
  entries: FaqEntry[];
  signal?: AbortSignal;
}): Promise<string> {
  const apiKey = args.apiKey.trim();
  if (!apiKey) {
    throw new Error("OpenRouter API key required for FAQ intro");
  }

  const questions = args.entries
    .map((e) => e.question.trim())
    .filter(Boolean)
    .slice(0, 12);
  if (!questions.length) {
    throw new Error("No FAQ questions for intro");
  }

  const keyword = (args.focusKeyword ?? "").trim() || "(none)";
  const title = (args.pageTitle ?? "").trim() || "(none)";
  const user = `Page title: ${title}
Focus keyword: ${keyword}

FAQ questions (for topical framing only; do not answer them):
${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Write the FAQ intro paragraph now.`;

  const { content } = await callOpenRouterChatCompletion({
    apiKey,
    model: args.model?.trim() || getProductionModel(),
    system: SYSTEM,
    user,
    maxTokens: 256,
    temperature: 0.4,
    signal: args.signal,
  });

  const intro = normalizeFaqIntroPlainText(content || "");
  if (!intro) {
    throw new Error("FAQ intro model returned empty text");
  }
  return intro;
}
