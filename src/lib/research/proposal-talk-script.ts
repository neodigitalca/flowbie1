/**
 * Specialist-facing client meeting script for the Proposal package: plain language,
 * glossary, talking points, and bullet key points per section. OpenRouter only
 * (see agent-contract-openrouter).
 *
 * If the combined report is extremely long, the OpenRouter request may exceed provider
 * limits; callers should catch errors and soft-fail (strategy + CSVs still export).
 */

import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { REPORT_TEMPERATURE } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { formatStrategistGuidancePrefix } from "@/lib/research/strategist-guidance";

/** Output budget for glossary plus per-section walkthrough (provider may clamp). */
export const PROPOSAL_TALK_SCRIPT_MAX_TOKENS = 12_000 as const;

export type ProposalTalkScriptMeta = {
  siteLabel: string;
  months: number;
  entitySapRowCount: number;
  contentBlogRowCount: number;
  geoLabel?: string | null;
};

/**
 * System instructions: Markdown script for a specialist leading a client meeting.
 * Exported for tests.
 */
export const PROPOSAL_TALK_SCRIPT_SYSTEM = [
  "ROLE: You write a client meeting script for a local SEO specialist who will walk a business owner through the written proposal in a live meeting.",
  "AUDIENCE: The script is for the specialist to read or paraphrase. The business owner is not technical. Use plain English, short sentences, and everyday words.",
  "VOICE: Confident and clear, not salesy. Explain what is in the document, not how software works.",
  "FORBIDDEN: Do not use the Unicode em dash character (U+2014). Use commas, periods, or hyphen for short joins.",
  "FORBIDDEN: Do not invent facts, competitors, metrics, or promises not grounded in METADATA_JSON, GRID_SUMMARY_MARKDOWN, COMBINED_PROPOSAL_MARKDOWN, or USER_STRATEGIST_GUIDANCE when present.",
  "When USER_STRATEGIST_GUIDANCE is present, reflect it in talking points where it aligns with the written proposal; do not contradict the proposal document.",
  "",
  "OUTPUT: Markdown only. Start with exactly one line: # Client meeting script",
  "",
  "Use ## headings in this order (skip a ## block only if there is no matching content in the proposal):",
  "",
  "## How to use this script (about 2 minutes)",
  "Two or three short paragraphs: tell the specialist to follow the sections in order, pause for questions, and point to the written proposal when the client wants detail.",
  "",
  "## Glossary (plain language)",
  "A bullet list of terms that appear in the proposal or meeting. For each item use the format: **Term** - one sentence a client can understand (use hyphen-minus, not an em dash). Include only terms that actually appear or are implied in the user message (examples may include: Google Business Profile, organic search, competitors, keywords, content plan, location pages, posts schedule, entity SAP rows, Search Console when relevant). Do not define technical SEO jargon unless the proposal uses it; prefer plain labels.",
  "",
  "## Opening (about 3 minutes)",
  "Welcome, confirm the business name and area from METADATA_JSON, set expectations for what you will cover, and invite questions at the end.",
  "",
  "## Grid and local market context (about 5 to 10 minutes)",
  "If GRID_SUMMARY_MARKDOWN is empty or says (empty), write one short paragraph that you will skip the grid story and go straight to the written sections. Otherwise explain positions and what they mean for visibility in plain language. Add a line starting exactly **Partner tips:** then sub-bullets with coaching for the specialist.",
  "",
  "## Competitor strategy - talking points",
  "Short intro paragraph. Then mirror the structure of the # Competitor strategy section in COMBINED_PROPOSAL_MARKDOWN: for each major H2 or theme you see there, add a ### subheading with a readable name, then:",
  "- One short paragraph of talking points (what the specialist should say).",
  "- A bullet list **Key points** with 3 to 6 bullets of the most important takeaways for the client.",
  "",
  "## Local SEO strategy - talking points",
  "Same pattern for the # Local SEO strategy part: for each major ## or ### section in that part of the proposal, add a ### subheading that matches the proposal heading, then a talking-points paragraph plus **Key points** bullets (3 to 6 per section). If a section is very long, summarize themes; do not read the table cell by cell.",
  "",
  "## Keywords or demand appendix (optional)",
  "If COMBINED_PROPOSAL_MARKDOWN includes a Keywords or appendix style block after Local SEO strategy, one short ## section with talking points and **Key points** bullets. If not present, omit this ## entirely.",
  "",
  "## Files and deliverables (about 3 minutes)",
  "Explain in plain language: the strategy is one document; separate spreadsheets list scheduled posts and entity location rows when counts in METADATA_JSON are greater than zero. Use entitySapRowCount and contentBlogRowCount and months from METADATA_JSON. Do not invent numbers.",
  "",
  "## Close (about 2 minutes)",
  "Recap next steps, how to reach the specialist, and **Partner tips:** sub-bullets for handling common questions.",
  "",
  "TIMING: In each ## heading line except Glossary and How to use, append an approximate minute range in parentheses (example: ## Opening (about 3 minutes)).",
  "TOTAL: Aim for roughly 25 to 35 minutes of spoken material across all timed sections.",
].join("\n");

export function buildProposalTalkScriptUserMessage(args: {
  gridSummaryMarkdown: string;
  combinedMarkdown: string;
  meta: ProposalTalkScriptMeta;
  strategistGuidance?: string;
}): string {
  const metaJson = JSON.stringify(args.meta);
  const grid = args.gridSummaryMarkdown.trim();
  const proposal = args.combinedMarkdown.trim();
  const guidance = formatStrategistGuidancePrefix(args.strategistGuidance);
  const blocks = [
    guidance ? guidance.trimEnd() : null,
    "METADATA_JSON:",
    metaJson,
    "",
    "GRID_SUMMARY_MARKDOWN:",
    grid || "(empty)",
    "",
    "COMBINED_PROPOSAL_MARKDOWN:",
    proposal || "(empty)",
  ].filter((line) => line !== null) as string[];
  return blocks.join("\n");
}

export type RunProposalTalkScriptArgs = {
  apiKey: string;
  model: string;
  gridSummaryMarkdown: string;
  combinedMarkdown: string;
  meta: ProposalTalkScriptMeta;
  strategistGuidance?: string;
  signal?: AbortSignal;
  /** Defaults to PROPOSAL_TALK_SCRIPT_MAX_TOKENS. */
  maxTokens?: number;
  temperature?: number;
};

export async function runProposalTalkScript(args: RunProposalTalkScriptArgs): Promise<string> {
  const user = buildProposalTalkScriptUserMessage({
    gridSummaryMarkdown: args.gridSummaryMarkdown,
    combinedMarkdown: args.combinedMarkdown,
    meta: args.meta,
    strategistGuidance: args.strategistGuidance,
  });
  const { content } = await callOpenRouterChatCompletion({
    apiKey: args.apiKey,
    model: args.model,
    system: PROPOSAL_TALK_SCRIPT_SYSTEM,
    user,
    maxTokens: args.maxTokens ?? PROPOSAL_TALK_SCRIPT_MAX_TOKENS,
    temperature: args.temperature ?? REPORT_TEMPERATURE,
    signal: args.signal,
  });
  return content.trim();
}
