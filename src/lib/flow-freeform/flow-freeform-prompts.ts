import type { FlowFreeformClarifyResult, FlowFreeformOutlineResult, FlowFreeformSectionPlan } from "./flow-freeform-types";

export function buildClarifySystemPrompt(): string {
  return `You help scope ONE blog article (Markdown) for this flow - not a multi-post series, email drip, or social calendar.
Output a single JSON object only, no markdown fences.
Schema: {"questions":[{"id":"string","text":"string","options":["string",...]}]}
Use 0–4 questions. Each question must have 2–6 distinct options. If the user goal is already specific enough, return {"questions":[]}.
Prioritize questions about content shape when the goal does not already specify format: e.g. blog format (explainer, listicle, how-to, comparison, roundup, FAQ-style), plus audience, angle, depth, and tone as appropriate.
Do NOT ask about monetization, ads, affiliate programs, sponsorship, posting cadence, or "building a series" / multi-part plans.
Ids must be snake_case unique.`;
}

export function buildClarifyUserPrompt(args: {
  flowTitle: string;
  flowPurpose: string;
  userGoalPrompt: string;
  kbPreview: string;
}): string {
  const kbBlock =
    args.kbPreview.trim().length > 0
      ? args.kbPreview.slice(0, 12_000)
      : "(none - optional; you may still ask clarifying questions about the goal.)";
  return `Deliverable: one Markdown blog article for this flow (single post).
Flow title: ${args.flowTitle || "(none)"}
Purpose: ${args.flowPurpose || "(none)"}
User goal:
${args.userGoalPrompt}

Knowledge base preview (optional; truncated):
${kbBlock}`;
}

export function buildOutlineSystemPrompt(): string {
  return `You design report sections for a knowledge-grounded deliverable. Output JSON only, no fences.
Schema: {"sections":[{"id":"string","h2Title":"string","ragQuery":"string","writerPrompt":"string"}]}
3–12 sections. h2Title is the human heading. ragQuery is keywords for retrieval. writerPrompt is instructions for writing that section (tone, bullets, constraints).
Ids: sec_1, sec_2, ... unique snake_case.`;
}

export function buildOutlineUserPrompt(args: {
  flowTitle: string;
  flowPurpose: string;
  userGoalPrompt: string;
  clarificationBlock: string;
  kbPreview: string;
}): string {
  const kbBlock =
    args.kbPreview.trim().length > 0
      ? args.kbPreview.slice(0, 16_000)
      : "(none - design sections from the goal and clarifications; ground in KB when present.)";
  return `Flow title: ${args.flowTitle || "(none)"}
Purpose: ${args.flowPurpose || "(none)"}
User goal:
${args.userGoalPrompt}

Clarifications (may be empty):
${args.clarificationBlock}

KB preview (optional):
${kbBlock}`;
}

export function buildSectionWriterSystemPrompt(): string {
  return `You write one Markdown section for a report. Use ## for the section title matching the given H2.
When RETRIEVED CONTEXT is provided, ground claims in it; when it says there is no knowledge base text, write from the goal and writer instructions only.
Be concise and factual. Do not invent metrics or citations. No preamble or closing outside this section.`;
}

export function buildSectionWriterUserPrompt(args: {
  flowTitle: string;
  siteContext: string;
  plan: FlowFreeformSectionPlan;
  retrievedContext: string;
}): string {
  return `Report: ${args.flowTitle || "Untitled"}
Context: ${args.siteContext}

Section H2: ${args.plan.h2Title}
Writer instructions:
${args.plan.writerPrompt}

Retrieval query: ${args.plan.ragQuery}

RETRIEVED CONTEXT:
${args.retrievedContext}`;
}

export function parseClarifyJson(raw: string): FlowFreeformClarifyResult {
  const stripped = stripJsonFence(raw);
  const j = JSON.parse(stripped) as unknown;
  if (!j || typeof j !== "object") throw new Error("Invalid clarify response");
  const questions = (j as { questions?: unknown }).questions;
  if (!Array.isArray(questions)) throw new Error("Invalid clarify: questions");
  const out: FlowFreeformClarifyResult = { questions: [] };
  for (const q of questions) {
    if (!q || typeof q !== "object") continue;
    const id = String((q as { id?: unknown }).id ?? "").trim();
    const text = String((q as { text?: unknown }).text ?? "").trim();
    const options = (q as { options?: unknown }).options;
    if (!id || !text || !Array.isArray(options) || options.length < 2) continue;
    out.questions.push({
      id,
      text,
      options: options.map((o) => String(o)),
    });
  }
  return out;
}

export function parseOutlineJson(raw: string): FlowFreeformOutlineResult {
  const stripped = stripJsonFence(raw);
  const j = JSON.parse(stripped) as unknown;
  if (!j || typeof j !== "object") throw new Error("Invalid outline response");
  const sections = (j as { sections?: unknown }).sections;
  if (!Array.isArray(sections) || sections.length === 0) throw new Error("Invalid outline: sections");
  const out: FlowFreeformSectionPlan[] = [];
  for (const s of sections) {
    if (!s || typeof s !== "object") continue;
    const id = String((s as { id?: unknown }).id ?? "").trim();
    const h2Title = String((s as { h2Title?: unknown }).h2Title ?? "").trim();
    const ragQuery = String((s as { ragQuery?: unknown }).ragQuery ?? "").trim();
    const writerPrompt = String((s as { writerPrompt?: unknown }).writerPrompt ?? "").trim();
    if (!id || !h2Title) continue;
    out.push({
      id,
      h2Title,
      ragQuery: ragQuery || h2Title,
      writerPrompt: writerPrompt || `Write "${h2Title}" grounded in context.`,
    });
  }
  if (out.length === 0) throw new Error("No valid sections in outline");
  return { sections: out };
}

function stripJsonFence(raw: string): string {
  let t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im;
  const m = t.match(fence);
  if (m?.[1]) t = m[1].trim();
  return t;
}

/** Parse {"title":"..."} from title-suggestion completions. */
export function parseSuggestTitleJson(raw: string): string {
  try {
    const j = JSON.parse(stripJsonFence(raw)) as unknown;
    if (!j || typeof j !== "object") return "";
    const t = (j as { title?: unknown }).title;
    return typeof t === "string" ? t.trim() : "";
  } catch {
    return "";
  }
}

export function buildEnhanceGoalSystemPrompt(): string {
  return `You improve a user's goal into a clear, actionable brief for a single blog article (outline + writing).
Preserve intent and scope; do not invent requirements. Output JSON only, no markdown fences.
Schema: {"enhancedPrompt":"string"}
The enhancedPrompt should be 2–8 sentences in plain language, suitable as the main instructions for one long-form blog post in Markdown.`;
}

export function buildEnhanceGoalUserPrompt(args: {
  flowTitle: string;
  userGoalPrompt: string;
  clarificationBlock: string;
  kbPreview: string;
}): string {
  const kbBlock =
    args.kbPreview.trim().length > 0
      ? args.kbPreview.slice(0, 12_000)
      : "(none)";
  return `Flow title: ${args.flowTitle || "(none)"}

Current goal:
${args.userGoalPrompt}

Clarifications already chosen (may be empty):
${args.clarificationBlock}

Knowledge base excerpt (optional):
${kbBlock}`;
}

export function parseEnhanceGoalJson(raw: string): string {
  try {
    const j = JSON.parse(stripJsonFence(raw)) as unknown;
    if (!j || typeof j !== "object") return "";
    const t = (j as { enhancedPrompt?: unknown }).enhancedPrompt;
    return typeof t === "string" ? t.trim() : "";
  } catch {
    return "";
  }
}
