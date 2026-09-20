import { callAdsReportingOpenRouterChatCompletion } from "@/lib/ads-reporting/ads-reporting-openrouter";
import {
  buildOpenRouterChatPostBodyJson,
  getCompetitorReportMaxOutputTokens,
} from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { sanitizeStrategistMarkdownSection } from "@/lib/competitor-research/competitor-report-markdown-sanitize";
import { AGENCY_NAME } from "@/lib/report-planner";
import {
  mergePinnedChunksWithRetrieval,
  pickFirstChunkPerSourceFile,
  retrieveTopChunks,
  splitGscFilesIntoChunks,
} from "@/lib/gsc-reporting/gsc-reporting-chunks";
import { runAdsReportingOutline } from "@/lib/ads-reporting/ads-reporting-outline";
import { applyAdsReportingMarkdownPost } from "@/lib/ads-reporting/ads-reporting-markdown-post";
import {
  buildAdsUserMessageForSection,
  getAdsReportingSectionSystemPrompt,
} from "@/lib/ads-reporting/ads-reporting-section-prompts";
import { buildAdsReportDocumentHeading } from "@/lib/ads-reporting/ads-reporting-document-title";
import { ADS_COMPARE_SIGNALS_FILENAME } from "@/lib/ads-reporting/ads-reporting-fetch";
import type {
  AdsReportingOutlineResult,
  AdsReportingPipelineProgress,
  AdsReportingPipelineResult,
  AdsReportingSectionResult,
} from "@/lib/ads-reporting/ads-reporting-types";
import { formatAdsOutlineCompleteLabel, formatAdsSectionCompleteLabel } from "@/lib/ads-reporting/ads-reporting-progress-log";

function stripLeadingH2Duplicate(md: string, expectedTitle: string): string {
  const lines = md.split("\n");
  const first = lines[0]?.trim() ?? "";
  if (first.toLowerCase() === `## ${expectedTitle}`.trim().toLowerCase()) {
    return lines.slice(1).join("\n").replace(/^\n+/, "");
  }
  return md;
}

export async function runAdsReportingPipeline(args: {
  apiKey: string;
  model: string;
  siteName: string;
  siteUrl: string;
  files: { name: string; content: string }[];
  compareKind?: "mom" | "yoy" | "custom";
  compareLabel?: string;
  signal?: AbortSignal;
  onProgress?: (p: AdsReportingPipelineProgress) => void | Promise<void>;
  onOutlineReady?: (payload: { outline: AdsReportingOutlineResult; outlineRequestBodyJson: string }) => void;
  onSectionStart?: (index: number) => void;
  onSectionReady?: (row: AdsReportingSectionResult) => void;
  priorSectionResults?: AdsReportingSectionResult[];
  savedOutline?: AdsReportingOutlineResult;
  savedOutlineRequestBodyJson?: string;
}): Promise<AdsReportingPipelineResult> {
  if (!args.apiKey.trim()) throw new Error("OpenRouter API key is required.");
  const nonEmpty = args.files.filter((f) => f.content.trim().length > 0);
  if (nonEmpty.length === 0) throw new Error("No Ads data loaded.");
  const compareKind = args.compareKind ?? "mom";
  const compareLabel = args.compareLabel ?? "";

  const { outline, truncatedInput, filenames, outlineRequestBodyJson } = args.savedOutline
    ? {
        outline: args.savedOutline,
        truncatedInput: false,
        filenames: nonEmpty.map((f) => f.name),
        outlineRequestBodyJson: args.savedOutlineRequestBodyJson ?? "",
      }
    : await runAdsReportingOutline({
        apiKey: args.apiKey,
        model: args.model,
        siteName: args.siteName,
        siteUrl: args.siteUrl,
        files: nonEmpty,
        compareKind,
        compareLabel,
        signal: args.signal,
      });

  if (!args.savedOutline) {
    args.onOutlineReady?.({ outline, outlineRequestBodyJson });
  }

  const totalSteps = 1 + outline.sections.length;
  await args.onProgress?.({
    step: 1,
    total: totalSteps,
    label: formatAdsOutlineCompleteLabel(outline.sections),
  });

  const chunks = splitGscFilesIntoChunks(nonEmpty);
  const signalsFile = nonEmpty.find((f) => f.name === ADS_COMPARE_SIGNALS_FILENAME);
  const priorByIndex = new Map((args.priorSectionResults ?? []).map((row) => [row.index, row]));
  const sectionResults: AdsReportingSectionResult[] = [...(args.priorSectionResults ?? [])];

  for (let i = 0; i < outline.sections.length; i++) {
    const prior = priorByIndex.get(i);
    if (prior) {
      args.onSectionStart?.(i);
      await args.onProgress?.({
        step: 2 + i,
        total: totalSteps,
        label: formatAdsSectionCompleteLabel(i, outline.sections.length, prior.plan.h2Title),
        sectionIndex: i,
      });
      args.onSectionReady?.(prior);
      continue;
    }
    const plan = outline.sections[i]!;
    args.onSectionStart?.(i);
    const pinned = pickFirstChunkPerSourceFile(chunks);
    const signalPin = signalsFile?.content.trim()
      ? [{ id: "ads-compare-signals", sourceFile: ADS_COMPARE_SIGNALS_FILENAME, text: signalsFile.content }]
      : [];
    const scored = retrieveTopChunks({
      chunks,
      ragQuery: plan.ragQuery,
      h2Title: plan.h2Title,
      maxChunks: 24,
      maxTotalChars: 28_000,
    });
    const retrieved = mergePinnedChunksWithRetrieval({
      pinned: [...signalPin, ...pinned],
      scored,
      maxChunks: 12,
      maxTotalChars: 28_000,
    });
    const user = buildAdsUserMessageForSection({
      siteName: args.siteName,
      siteUrl: args.siteUrl,
      outline,
      plan,
      retrievedContext: retrieved.map((c) => c.text).join("\n\n---\n\n"),
      compareLabel,
    });
    const system = getAdsReportingSectionSystemPrompt(plan.kind, compareKind);
    const maxTokens = Math.min(16_000, getCompetitorReportMaxOutputTokens(args.model));
    const requestBodyJson = buildOpenRouterChatPostBodyJson({
      model: args.model,
      maxTokensRequested: maxTokens,
      system,
      userMessage: user,
    });
    const { content } = await callAdsReportingOpenRouterChatCompletion({
      apiKey: args.apiKey,
      model: args.model,
      system,
      user,
      maxTokens,
      signal: args.signal,
    });
    let body = sanitizeStrategistMarkdownSection(content.trim());
    body = stripLeadingH2Duplicate(body, plan.h2Title);
    body = applyAdsReportingMarkdownPost(body, plan.kind);
    const row: AdsReportingSectionResult = {
      plan,
      index: i,
      markdownBlock: `## ${plan.h2Title}\n\n${body.trim()}\n`,
      requestBodyJson,
    };
    sectionResults.push(row);
    await args.onProgress?.({
      step: 2 + i,
      total: totalSteps,
      label: formatAdsSectionCompleteLabel(i, outline.sections.length, plan.h2Title),
      sectionIndex: i,
    });
    args.onSectionReady?.(row);
  }

  const title = [
    `# ${buildAdsReportDocumentHeading(compareLabel)}`,
    "",
    AGENCY_NAME,
    `Prepared for: ${args.siteName}`,
    "",
  ].join("\n");
  const ordered = [...sectionResults].sort((a, b) => a.index - b.index);
  return {
    markdown: [title, ...ordered.map((s) => s.markdownBlock)].join("\n"),
    outline,
    truncatedInput,
    filenames,
    sectionResults: ordered,
    outlineRequestBodyJson,
  };
}
