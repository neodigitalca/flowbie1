import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { LEGACY_REDIRECT_MATCH_AGENT_MAX_TOKENS } from "@/lib/sitemap-optimizer/constants";
import { buildLegacyRedirectGridRowsFromUrls } from "@/lib/sitemap-optimizer/legacy-redirect-grid-rows";
import { parseLegacyRedirectExtractAgentJson } from "@/lib/sitemap-optimizer/legacy-redirect-match-parse";
import type { LegacyRedirectGridRow } from "@/lib/sitemap-optimizer/types";

const LEGACY_REDIRECT_EXTRACT_SYSTEM = `You are a senior SEO strategist. You receive a raw upload (CSV, GSC coverage export, spreadsheet export, or plain URL list).

Your job:
1. Read the entire upload and extract every legacy URL that should receive a 301 redirect.
2. Preserve the order URLs appear in the upload (top to bottom).
3. Return one legacyUrls[] entry per distinct redirect-worthy URL. Skip blank lines and header labels only.

Hard rules:
- Each legacyUrls entry must be a full http(s) URL copied from the upload.
- Do not invent URLs. Do not guess destinations.
- Return ONLY valid JSON (no markdown fences).`;

export async function runLegacyRedirectSheetExtractAgent(args: {
  legacySheetText: string;
  legacySheetName?: string;
  apiKey: string;
  siteId: string;
  signal?: AbortSignal;
}): Promise<LegacyRedirectGridRow[]> {
  const { legacySheetText, legacySheetName, apiKey, siteId, signal } = args;
  const sheet = legacySheetText.trim();
  if (!sheet) {
    throw new Error("Legacy URL upload is empty.");
  }

  const model = getResearchModel(siteId);
  const user = JSON.stringify({
    task: "legacy_redirect_extract_urls_from_upload",
    legacySheetName: legacySheetName ?? "upload",
    legacySheetText: sheet,
    outputSchema: {
      legacyUrls: ["string (full legacy URL from the upload, in sheet order)"],
    },
  });

  const { content } = await callOpenRouterChatCompletion({
    apiKey,
    model,
    system: LEGACY_REDIRECT_EXTRACT_SYSTEM,
    user,
    maxTokens: LEGACY_REDIRECT_MATCH_AGENT_MAX_TOKENS,
    temperature: 0.1,
    responseFormat: { type: "json_object" },
    signal,
  });

  const urls = parseLegacyRedirectExtractAgentJson(content);
  const rows = buildLegacyRedirectGridRowsFromUrls(urls);
  return rows;
}
