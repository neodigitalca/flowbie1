import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
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
import {
  buildSapEntityAllowlistChunkText,
  buildSapFilteredPagesChunkText,
  isPagesMomReportingFile,
} from "@/lib/gsc-reporting/gsc-reporting-sap-entity-context";
import {
  buildCompareSignalsPinChunk,
  COMPARE_SIGNALS_SECTION_KINDS,
  ensureCompareSignalsFile,
} from "@/lib/gsc-reporting/gsc-reporting-compare-signals";
import { runGscReportingOutline } from "@/lib/gsc-reporting/gsc-reporting-outline";
import { applyGscReportingMarkdownPost } from "@/lib/gsc-reporting/gsc-reporting-markdown-post";
import {
  buildUserMessageForSection,
  getGscReportingSectionSystemPrompt,
} from "@/lib/gsc-reporting/gsc-reporting-section-prompts";
import type {
  GscReportingChunk,
  GscReportingPipelineResult,
  GscReportingSectionResult,
  RunGscReportingPipelineArgs,
} from "@/lib/gsc-reporting/gsc-reporting-types";

const RETRIEVAL_MAX_TOTAL_CHARS = 28_000;
const RETRIEVAL_MAX_CHUNKS = 12;
/** Executive summary allows more rows after per-file pins without raising the char budget. */
const RETRIEVAL_MAX_CHUNKS_EXEC_SUMMARY = 18;
/** Larger pool before merge so pins do not replace all lexical hits. */
const RETRIEVAL_SCORED_POOL_CHUNKS = 24;

function stripLeadingH2Duplicate(md: string, expectedTitle: string): string {
  const lines = md.split("\n");
  const first = lines[0]?.trim() ?? "";
  const want = `## ${expectedTitle}`.trim();
  if (first.toLowerCase() === want.toLowerCase()) {
    return lines.slice(1).join("\n").replace(/^\n+/, "");
  }
  return md;
}

export async function runGscReportingPipeline(args: RunGscReportingPipelineArgs): Promise<GscReportingPipelineResult> {
  const {
    apiKey,
    model,
    siteName,
    siteUrl,
    files,
    sapEntityGrounding,
    compareKind = "mom",
    compareLabel = "",
    signal,
    onProgress,
    onOutlineReady,
    onSectionStart,
    onSectionReady,
    priorSectionResults = [],
    savedOutline,
    savedOutlineRequestBodyJson,
  } = args;
  if (!apiKey.trim()) throw new Error("OpenRouter API key is required.");
  if (files.length === 0) throw new Error("No GSC data loaded.");

  const nonEmpty = files.filter((f) => f.content.trim().length > 0);
  if (nonEmpty.length === 0) throw new Error("All GSC files are empty.");

  const bundledFiles =
    compareLabel.trim().length > 0
      ? ensureCompareSignalsFile(nonEmpty, compareKind, compareLabel)
      : nonEmpty;

  const { outline, truncatedInput, filenames, outlineRequestBodyJson } = savedOutline
    ? {
        outline: savedOutline,
        truncatedInput: false,
        filenames: bundledFiles.map((f) => f.name),
        outlineRequestBodyJson: savedOutlineRequestBodyJson ?? "",
      }
    : await runGscReportingOutline({
        apiKey,
        model,
        siteName,
        siteUrl,
        files: bundledFiles,
        compareKind,
        signal,
      });

  if (!savedOutline) {
    onOutlineReady?.({ outline, outlineRequestBodyJson });
  }

  const totalSteps = 1 + outline.sections.length;
  onProgress?.({ step: 1, total: totalSteps, label: "Outline complete" });
  const chunks = splitGscFilesIntoChunks(bundledFiles);
  const compareSignalsPin = buildCompareSignalsPinChunk(bundledFiles);
  const priorByIndex = new Map(priorSectionResults.map((row) => [row.index, row]));
  const sectionResults: GscReportingSectionResult[] = [...priorSectionResults];

  const plans = outline.sections;
  const sectionTotal = plans.length;
  for (let i = 0; i < plans.length; i++) {
    const prior = priorByIndex.get(i);
    if (prior) {
      onSectionStart?.(i, prior.plan);
      onProgress?.({
        step: 2 + i,
        total: totalSteps,
        label: `Section ${i + 1}/${sectionTotal}: ${prior.plan.h2Title.slice(0, 48)}…`,
      });
      onSectionReady?.(prior);
      continue;
    }

    const plan = plans[i]!;
    onSectionStart?.(i, plan);
    onProgress?.({
      step: 2 + i,
      total: totalSteps,
      label: `Section ${i + 1}/${sectionTotal}: ${plan.h2Title.slice(0, 48)}…`,
    });

    const pinnedBase = pickFirstChunkPerSourceFile(chunks);
    let pinned: GscReportingChunk[] = pinnedBase;
    if (plan.kind === "sap_local_seo" && sapEntityGrounding) {
      pinned = pinnedBase.filter((c) => !isPagesMomReportingFile(c.sourceFile));
    }

    const sapPins: GscReportingChunk[] =
      plan.kind === "sap_local_seo" && sapEntityGrounding
        ? [
            {
              id: "sap-entity-allowlist",
              sourceFile: "__SAP_ENTITY_ALLOWLIST__",
              text: buildSapEntityAllowlistChunkText(sapEntityGrounding),
            },
            {
              id: "sap-filtered-pages",
              sourceFile: "__SAP_FILTERED_PAGES__",
              text: buildSapFilteredPagesChunkText(sapEntityGrounding),
            },
          ]
        : [];

    const compareSignalPins: GscReportingChunk[] =
      compareSignalsPin && COMPARE_SIGNALS_SECTION_KINDS.has(plan.kind)
        ? [
            {
              id: compareSignalsPin.id,
              sourceFile: compareSignalsPin.sourceFile,
              text: compareSignalsPin.text,
            },
          ]
        : [];

    const pinnedMerged = [...compareSignalPins, ...sapPins, ...pinned];

    const chunksForRag =
      plan.kind === "sap_local_seo" && sapEntityGrounding
        ? chunks.filter((c) => !isPagesMomReportingFile(c.sourceFile))
        : chunks;

    const scoredPool = retrieveTopChunks({
      chunks: chunksForRag,
      ragQuery: plan.ragQuery,
      h2Title: plan.h2Title,
      maxChunks: RETRIEVAL_SCORED_POOL_CHUNKS,
      maxTotalChars: RETRIEVAL_MAX_TOTAL_CHARS,
    });
    const retrievalChunkCap =
      plan.kind === "executive_summary" ? RETRIEVAL_MAX_CHUNKS_EXEC_SUMMARY : RETRIEVAL_MAX_CHUNKS;
    const retrieved = mergePinnedChunksWithRetrieval({
      pinned: pinnedMerged,
      scored: scoredPool,
      maxChunks: retrievalChunkCap,
      maxTotalChars: RETRIEVAL_MAX_TOTAL_CHARS,
    });
    const retrievedContext = retrieved.map((c) => c.text).join("\n\n---\n\n");

    const user = buildUserMessageForSection({
      siteName,
      siteUrl,
      outline,
      plan,
      retrievedContext,
    });

    const system = getGscReportingSectionSystemPrompt(plan.kind, compareKind);
    const maxTokens = Math.min(16_000, getCompetitorReportMaxOutputTokens(model));

    const requestBodyJson = buildOpenRouterChatPostBodyJson({
      model,
      maxTokensRequested: maxTokens,
      system,
      userMessage: user,
    });

    const { content } = await callOpenRouterChatCompletion({
      apiKey,
      model,
      system,
      user,
      maxTokens,
      signal,
    });

    let body = sanitizeStrategistMarkdownSection(content.trim());
    body = stripLeadingH2Duplicate(body, plan.h2Title);
    body = applyGscReportingMarkdownPost(body, plan.kind);
    const markdownBlock = `## ${plan.h2Title}\n\n${body.trim()}\n`;
    const row: GscReportingSectionResult = {
      plan,
      index: i,
      markdownBlock,
      requestBodyJson,
    };
    sectionResults.push(row);
    onSectionReady?.(row);
  }

  const title = [
    "# Organic Search Performance Report",
    "",
    AGENCY_NAME,
    `Prepared for: ${siteName}`,
    "",
  ].join("\n");
  const orderedSections = [...sectionResults].sort((a, b) => a.index - b.index);
  const markdown = [title, ...orderedSections.map((s) => s.markdownBlock)].join("\n");

  onProgress?.({ step: totalSteps, total: totalSteps, label: "Done" });

  return {
    markdown,
    outline,
    truncatedInput,
    filenames,
    sectionResults: orderedSections,
    outlineRequestBodyJson,
  };
}
