import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { parseAssistantJsonObject } from "@/lib/competitor-research/competitor-report-json-parse";
import { stripPipeBrandSuffixFromTitle } from "@/lib/sap-title-pipe-brand";
import type { CompetitorComparisonResult, ConnectedSiteProfile } from "@/lib/competitor/types";
import { buildModifierFromComparison } from "@/lib/competitor/compare-competitor-agent";

const TITLE_SYSTEM = `You are a local SEO title agent for comparison-style landing pages.

Output ONLY valid JSON: {"title":"..."}

Rules:
- title: natural, click-worthy H1-style title for a page comparing options for the keyword
- Include the competitor business name (entity) and keyword naturally
- Do NOT claim the connected site is best or #1
- Avoid em dash characters`;

export async function runCompetitorTitleRowAgent(args: {
  apiKey: string;
  model: string;
  keyword: string;
  entity: string;
  connected: ConnectedSiteProfile;
  comparison: CompetitorComparisonResult;
  suggestedTitleFormat?: string;
  signal?: AbortSignal;
}): Promise<{ title: string; modifier: string }> {
  const keyword = args.keyword.trim();
  if (!keyword) {
    throw new Error("Keyword is required for competitor title row.");
  }

  const comparisonBrief = buildModifierFromComparison(args.comparison);

  const payload = {
    keyword,
    entity: args.entity,
    connectedSiteName: args.connected.siteName,
    suggestedTitleFormat: args.suggestedTitleFormat,
  };

  const { content } = await callOpenRouterChatCompletion({
    apiKey: args.apiKey,
    model: args.model,
    system: TITLE_SYSTEM,
    user: JSON.stringify(payload),
    maxTokens: 1024,
    temperature: 0.35,
    responseFormat: { type: "json_object" },
    signal: args.signal,
  });

  const parsed = parseAssistantJsonObject(content) as { title?: unknown };
  const agentTitle = stripPipeBrandSuffixFromTitle(String(parsed.title ?? "").trim(), args.connected.siteName);
  const formattedTitle = stripPipeBrandSuffixFromTitle(
    (args.suggestedTitleFormat ?? `{entity} and ${keyword}: what to compare`)
      .replace(/{entity}/g, args.entity)
      .replace(/{keyword}/g, keyword),
    args.connected.siteName,
  );
  const title = agentTitle || formattedTitle;
  if (!title) {
    throw new Error("Title agent returned an empty title.");
  }

  return { title, modifier: comparisonBrief };
}

export function suggestCompetitorTitleFormat(keyword: string): string {
  const trimmed = keyword.trim();
  if (!trimmed) {
    throw new Error("Keyword is required for competitor title format.");
  }
  return `{entity} and ${trimmed}: what to compare`;
}
