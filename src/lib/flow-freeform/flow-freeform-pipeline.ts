import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import {
  getCompetitorReportMaxOutputTokens,
  REPORT_TEMPERATURE,
} from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { sanitizeStrategistMarkdownSection } from "@/lib/competitor-research/competitor-report-markdown-sanitize";
import {
  buildClarifySystemPrompt,
  buildClarifyUserPrompt,
  buildEnhanceGoalSystemPrompt,
  buildEnhanceGoalUserPrompt,
  buildOutlineSystemPrompt,
  buildOutlineUserPrompt,
  buildSectionWriterSystemPrompt,
  buildSectionWriterUserPrompt,
  parseClarifyJson,
  parseEnhanceGoalJson,
  parseOutlineJson,
  parseSuggestTitleJson,
} from "./flow-freeform-prompts";
import { retrieveTopKbChunks } from "./flow-freeform-retrieval";
import type { FlowFreeformClarifyResult, FlowFreeformSectionBody, FlowFreeformSectionPlan } from "./flow-freeform-types";

const JSON_TEMP = 0.25;
const MAX_CLARIFY_TOKENS = 4_096;
const MAX_OUTLINE_TOKENS = 8_192;
const MAX_TITLE_SUGGEST_TOKENS = 256;
const MAX_ENHANCE_GOAL_TOKENS = 2_048;
const RETRIEVAL_MAX_CHUNKS = 12;
const RETRIEVAL_MAX_CHARS = 28_000;

/** Suggests a short report title from the user goal + KB excerpt (JSON {"title":"..."}). */
export async function runFlowFreeformSuggestTitle(args: {
  apiKey: string;
  model: string;
  userGoalPrompt: string;
  kbText: string;
  signal?: AbortSignal;
}): Promise<string> {
  const { content } = await callOpenRouterChatCompletion({
    apiKey: args.apiKey,
    model: args.model,
    system: `You output JSON only: {"title":"..."}. The title is a concise professional report title (max 12 words). No quotation marks inside the title string.`,
    user: `User goal:\n${args.userGoalPrompt}\n\nKnowledge base excerpt:\n${args.kbText.slice(0, 4000)}`,
    maxTokens: Math.min(MAX_TITLE_SUGGEST_TOKENS, getCompetitorReportMaxOutputTokens(args.model)),
    signal: args.signal,
    temperature: 0.35,
    responseFormat: { type: "json_object" },
  });
  const parsed = parseSuggestTitleJson(content);
  if (parsed) return parsed;
  const line = args.userGoalPrompt.trim().split("\n")[0] ?? "";
  return line.slice(0, 80) || "Report";
}

/** Rewrites the goal prompt into a clearer brief (JSON {"enhancedPrompt":"..."}). */
export async function runFlowFreeformEnhanceGoalPrompt(args: {
  apiKey: string;
  model: string;
  flowTitle: string;
  userGoalPrompt: string;
  clarificationAnswers: Record<string, string>;
  kbText: string;
  signal?: AbortSignal;
}): Promise<string> {
  const clarificationBlock =
    Object.keys(args.clarificationAnswers).length === 0
      ? "(none)"
      : Object.entries(args.clarificationAnswers)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n");
  const { content } = await callOpenRouterChatCompletion({
    apiKey: args.apiKey,
    model: args.model,
    system: buildEnhanceGoalSystemPrompt(),
    user: buildEnhanceGoalUserPrompt({
      flowTitle: args.flowTitle,
      userGoalPrompt: args.userGoalPrompt,
      clarificationBlock,
      kbPreview: args.kbText,
    }),
    maxTokens: Math.min(MAX_ENHANCE_GOAL_TOKENS, getCompetitorReportMaxOutputTokens(args.model)),
    signal: args.signal,
    temperature: 0.35,
    responseFormat: { type: "json_object" },
  });
  const parsed = parseEnhanceGoalJson(content);
  if (parsed) return parsed;
  return args.userGoalPrompt.trim();
}

export async function runFlowFreeformClarify(args: {
  apiKey: string;
  model: string;
  flowTitle: string;
  flowPurpose: string;
  userGoalPrompt: string;
  kbText: string;
  signal?: AbortSignal;
}): Promise<FlowFreeformClarifyResult> {
  const { content } = await callOpenRouterChatCompletion({
    apiKey: args.apiKey,
    model: args.model,
    system: buildClarifySystemPrompt(),
    user: buildClarifyUserPrompt({
      flowTitle: args.flowTitle,
      flowPurpose: args.flowPurpose,
      userGoalPrompt: args.userGoalPrompt,
      kbPreview: args.kbText,
    }),
    maxTokens: Math.min(MAX_CLARIFY_TOKENS, getCompetitorReportMaxOutputTokens(args.model)),
    signal: args.signal,
    temperature: JSON_TEMP,
    responseFormat: { type: "json_object" },
  });
  return parseClarifyJson(content);
}

export async function runFlowFreeformOutline(args: {
  apiKey: string;
  model: string;
  flowTitle: string;
  flowPurpose: string;
  userGoalPrompt: string;
  clarificationAnswers: Record<string, string>;
  kbText: string;
  signal?: AbortSignal;
}): Promise<FlowFreeformSectionPlan[]> {
  const clarificationBlock =
    Object.keys(args.clarificationAnswers).length === 0
      ? "(none)"
      : Object.entries(args.clarificationAnswers)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n");
  const { content } = await callOpenRouterChatCompletion({
    apiKey: args.apiKey,
    model: args.model,
    system: buildOutlineSystemPrompt(),
    user: buildOutlineUserPrompt({
      flowTitle: args.flowTitle,
      flowPurpose: args.flowPurpose,
      userGoalPrompt: args.userGoalPrompt,
      clarificationBlock,
      kbPreview: args.kbText,
    }),
    maxTokens: Math.min(MAX_OUTLINE_TOKENS, getCompetitorReportMaxOutputTokens(args.model)),
    signal: args.signal,
    temperature: JSON_TEMP,
    responseFormat: { type: "json_object" },
  });
  return parseOutlineJson(content).sections;
}

export async function runFlowFreeformOneSection(args: {
  apiKey: string;
  model: string;
  flowTitle: string;
  flowPurpose: string;
  kbText: string;
  plan: FlowFreeformSectionPlan;
  index: number;
  signal?: AbortSignal;
}): Promise<FlowFreeformSectionBody> {
  const retrieved = retrieveTopKbChunks({
    kbText: args.kbText,
    ragQuery: args.plan.ragQuery,
    h2Title: args.plan.h2Title,
    maxChunks: RETRIEVAL_MAX_CHUNKS,
    maxTotalChars: RETRIEVAL_MAX_CHARS,
  });
  const retrievedContext = retrieved.map((c) => c.text).join("\n\n---\n\n");
  const siteContext = args.flowPurpose.trim() || args.flowTitle.trim() || "General report";
  const system = buildSectionWriterSystemPrompt();
  const user = buildSectionWriterUserPrompt({
    flowTitle: args.flowTitle,
    siteContext,
    plan: args.plan,
    retrievedContext:
      retrievedContext ||
      "(no knowledge base text - write the section from the report goal and writer instructions only; do not invent specific statistics or citations.)",
  });
  const maxTokens = Math.min(16_000, getCompetitorReportMaxOutputTokens(args.model));
  const { content } = await callOpenRouterChatCompletion({
    apiKey: args.apiKey,
    model: args.model,
    system,
    user,
    maxTokens,
    signal: args.signal,
    temperature: REPORT_TEMPERATURE,
  });
  const md = sanitizeStrategistMarkdownSection(content.trim());
  const block = md.startsWith("##") ? md : `## ${args.plan.h2Title}\n\n${md}`;
  return {
    plan: args.plan,
    index: args.index,
    markdownBlock: block,
  };
}

export function stitchSectionMarkdown(sections: FlowFreeformSectionBody[]): string {
  return sections.map((s) => s.markdownBlock.trim()).join("\n\n");
}

export function buildPlanMarkdownDoc(plans: FlowFreeformSectionPlan[]): string {
  const lines = ["# Report outline", ""];
  plans.forEach((p, i) => {
    lines.push(`${i + 1}. **${p.h2Title}** (\`${p.id}\`)`);
    lines.push(`   - Retrieval: ${p.ragQuery}`);
    lines.push("");
  });
  return lines.join("\n");
}
