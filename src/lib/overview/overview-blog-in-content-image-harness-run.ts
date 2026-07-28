import type { Dispatch, SetStateAction } from "react";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import {
  mergeHarnessProgressSiteAndBatch,
  setOptimizingState,
} from "@/hooks/content-optimization/optimization-helpers-a";
import { mergeOptimizationProgress } from "@/hooks/content-optimization/optimization-helpers";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";
import { ensureMasterInstructionsInMemory } from "@/lib/master-instructions-storage";
import {
  initOverviewBulkHarnessPagination,
  setOverviewBulkHarnessPageState,
} from "@/lib/overview/overview-bulk-page-state";
import { overviewBulkPageRanges } from "@/lib/overview/overview-bulk-page-size";
import { extractH2TextsFromHtml } from "@/lib/overview/overview-blog-headers-extract";
import { resolveOverviewSourceHtml } from "@/lib/overview/overview-blog-overview-prepend";
import type { OverviewHarnessSetters } from "@/lib/overview/overview-blog-overview-harness-mutations";
import { reduceHarnessSectionList } from "@/lib/bulk/harness-sections-reducer";
import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import { generateInContentImageFromHtml } from "@/lib/in-content-image-generator";
import { generateLocalInContentImageFromHtml } from "@/lib/overview/overview-blog-local-image-generate";
import {
  buildPeerSitesPlanFile,
  formatPeerSitesChecklistStatus,
  mergeGeneratedFilesByName,
} from "@/lib/overview/overview-peer-csv-details";
import { resolveLocalImagePlaceEntity } from "@/lib/overview/overview-local-image-dfs-normalize";
import {
  extractPreferredBodyImageFromHtml,
  htmlHasLocalInContentImage,
  prewarmSapPeerSiteInventories,
  stripPreferredBodyImageFromHtml,
} from "@/lib/overview/sap-cross-site-image-search";
import {
  gateLocalImageExistingScope,
  type LocalImageExistingScope,
} from "@/lib/overview/local-image-existing-scope";
import {
  buildWaitingInContentImageHarnessSections,
  formatInContentAnalyzeMarkdown,
  formatInContentImageResultMarkdown,
  formatLocalImageChecklistMarkdown,
  formatPeerLocalImageLibraryChecklistMarkdown,
  appendLocalImagePhaseLog,
  formatLocalImagePhaseLine,
  rebuildLocalImageBatchSummaryFile,
  IN_CONTENT_IMAGE_HARNESS_SECTION_TITLES,
  IN_CONTENT_STEP_ANALYZE,
  IN_CONTENT_STEP_CHECKLIST,
  IN_CONTENT_STEP_GENERATE,
  IN_CONTENT_STEP_INSERT,
  makeInContentImageHarnessDonePayload,
  makeInContentImageHarnessProgressPayload,
  makeInContentImageHarnessStartPayload,
} from "@/lib/overview/overview-blog-in-content-image-harness-sections";

type SetBulkState = Dispatch<SetStateAction<Record<string, BulkOptimizationState>>>;
type SetOptProgress = Dispatch<SetStateAction<Record<string, unknown>>>;
type SetIsOptimizing = Dispatch<SetStateAction<Record<string, boolean>>>;

export type BlogInContentImageCatalogRow = {
  index: number;
  url: string;
  title: string;
  focusKeyword: string;
  pageHeading?: string;
  html: string;
  /** When set, skip auto heading pick. */
  forcedSectionHeader?: string;
  imageKind?: "photo" | "local";
  /** Local: both modes search peer caches first; find errors on miss, generate falls through to AI. */
  localImageMode?: "find" | "generate";
  /** Generate Local: new (default) / old (replace) / all. */
  localImageExistingScope?: LocalImageExistingScope;
};

function setInContentImageHarnessMessage(
  setters: OverviewHarnessSetters,
  message: string,
  progress?: number,
): void {
  const pct = progress ?? 5;
  setters.setBulkOptimizationState((prev) => {
    const current = prev[setters.batchKey];
    if (!current) return prev;
    return {
      ...prev,
      [setters.batchKey]: {
        ...current,
        currentStepProgress: {
          ...(current.currentStepProgress || {}),
          step: "In Content Image",
          progress: pct,
          message,
        },
      },
    };
  });
  setters.setOptimizationProgress((prev) => {
    const next = { ...(prev as Record<string, unknown>) };
    mergeHarnessProgressSiteAndBatch(next, setters.siteId, {
      step: "In Content Image",
      progress: pct,
      message,
    });
    return next;
  });
}

function emitInContentImageHarnessPayload(
  url: string,
  setters: OverviewHarnessSetters,
  payload: BulkHarnessSectionPayload,
): void {
  const progressLine =
    payload.phase === "progress" && payload.markdownSlice?.trim()
      ? payload.markdownSlice.trim().split("\n").pop() || payload.title
      : payload.title;
  const message =
    payload.phase === "progress"
      ? `In Content Image: ${progressLine}`
      : `In Content Image ${payload.sectionIndex + 1}/${payload.totalSections}: ${payload.title}${payload.phase === "start" ? "…" : ""}`;
  const progress =
    10 +
    Math.round(
      ((payload.sectionIndex +
        (payload.phase === "done" ? 1 : payload.phase === "progress" ? 0.65 : 0.5)) /
        Math.max(payload.totalSections, 1)) *
        80,
    );

  setters.setBulkOptimizationState((prev) => {
    const current = prev[setters.batchKey];
    if (!current) return prev;
    const prevSections = current.urlHarnessSections?.[url] ?? [];
    const nextUrlSections = reduceHarnessSectionList(prevSections, payload);
    return {
      ...prev,
      [setters.batchKey]: {
        ...current,
        currentUrl: url,
        urlHarnessSections: {
          ...(current.urlHarnessSections || {}),
          [url]: nextUrlSections,
        },
        currentStepProgress: {
          ...(current.currentStepProgress || {}),
          step: "In Content Image",
          progress,
          message,
          harnessPlannedSectionCount: IN_CONTENT_IMAGE_HARNESS_SECTION_TITLES.length,
        },
      },
    };
  });

  setters.setOptimizationProgress((prev) =>
    mergeHarnessProgressSiteAndBatch(prev as Record<string, unknown>, setters.siteId, {
      step: "In Content Image",
      progress,
      message,
      harnessPlannedSectionCount: IN_CONTENT_IMAGE_HARNESS_SECTION_TITLES.length,
    }),
  );
}

export function initOverviewBlogInContentImageHarnessBatchState(params: {
  site: WordPressSite;
  catalog: BlogInContentImageCatalogRow[];
  setBulkOptimizationState: SetBulkState;
  setOptimizationProgress: SetOptProgress;
  setIsOptimizingContent: SetIsOptimizing;
  prepMessage?: string;
}): string {
  const {
    site,
    catalog,
    setBulkOptimizationState,
    setOptimizationProgress,
    setIsOptimizingContent,
    prepMessage = "Preparing In Content Image batch…",
  } = params;

  const batchKey = `${site.id}-batch`;
  const urls = catalog.map((c) => c.url.trim()).filter(Boolean);
  const urlKeywords: Record<string, string> = {};
  const initialUrlStatuses: BulkOptimizationState["urlStatuses"] = {};
  const urlHarnessSections: NonNullable<BulkOptimizationState["urlHarnessSections"]> = {};

  for (const entry of catalog) {
    const url = entry.url.trim();
    if (!url) continue;
    if (entry.focusKeyword) urlKeywords[url] = entry.focusKeyword;
    initialUrlStatuses[url] = "pending";
    urlHarnessSections[url] = buildWaitingInContentImageHarnessSections();
  }

  setOptimizingState(setIsOptimizingContent, batchKey, true);
  setOptimizationProgress((prev) =>
    mergeOptimizationProgress(prev as Record<string, unknown>, site.id, {
      step: "In Content Image",
      progress: 2,
      message: prepMessage,
      harnessSections: [],
      harnessPlannedSectionCount: IN_CONTENT_IMAGE_HARNESS_SECTION_TITLES.length,
    }),
  );
  setBulkOptimizationState((prev) => ({
    ...prev,
    [batchKey]: {
      urls,
      currentIndex: 0,
      urlStatuses: initialUrlStatuses,
      currentStep: "In Content Image",
      currentUrl: urls[0],
      urlKeywords,
      runKind: "aiInContentImage",
      harnessStartedAt: Date.now(),
      urlHarnessSections,
      urlGeneratedFiles: {},
      currentStepProgress: {
        step: "In Content Image",
        progress: 2,
        message: prepMessage,
        harnessSections: [],
        harnessPlannedSectionCount: IN_CONTENT_IMAGE_HARNESS_SECTION_TITLES.length,
      },
    },
  }));
  initOverviewBulkHarnessPagination(batchKey, urls.length, setBulkOptimizationState);

  return batchKey;
}

export function finalizeOverviewBlogInContentImageHarnessBatch(
  batchKey: string,
  siteId: string,
  setIsOptimizingContent: SetIsOptimizing,
  setOptimizationProgress: SetOptProgress,
  setBulkOptimizationState?: (prev: any) => any,
): void {
  setOptimizingState(setIsOptimizingContent, batchKey, false);
  // Also clear leftover site-level optimizing from a prior Content Opt run.
  setIsOptimizingContent((prev: any) => {
    const updated = { ...(prev as Record<string, boolean>) };
    delete updated[siteId];
    return updated;
  });
  // Keep the batch state so the completed report stays visible in the Details drawer.
  // It is cleared only when the user explicitly closes the batch (resetBulkBatch).
  if (setBulkOptimizationState) {
    setBulkOptimizationState((prev: any) => {
      const current = prev[batchKey];
      if (!current) return prev;
      return { ...prev, [batchKey]: { ...current, currentStep: "Complete" } };
    });
  }
  setOptimizationProgress((prev) => {
    const next = { ...(prev as Record<string, unknown>) };
    delete next[batchKey];
    mergeHarnessProgressSiteAndBatch(next, siteId, {
      step: "Complete",
      progress: 100,
      message: "In Content Image batch finished",
    });
    return next;
  });
}

export type RunOverviewBlogInContentImageHarnessBatchParams = {
  catalog: BlogInContentImageCatalogRow[];
  site: WordPressSite;
  apiKey: string;
  model?: string;
  /** When false, local kind rows error (non-SAP). */
  allowLocalImage?: boolean;
  /** Connected Integration sites for Local Image cross-site reuse. */
  peerSites?: WordPressSite[];
  harnessSetters: OverviewHarnessSetters;
  updateRow: (index: number, patch: Partial<OverviewRow>) => void;
  onRowOk?: (url: string, html: string) => void;
};

export async function runOverviewBlogInContentImageHarnessBatch(
  params: RunOverviewBlogInContentImageHarnessBatchParams,
): Promise<{ ok: number; failed: number }> {
  const {
    catalog,
    site,
    apiKey,
    model,
    allowLocalImage = false,
    peerSites,
    harnessSetters,
    updateRow,
    onRowOk,
  } = params;
  if (!catalog.length) return { ok: 0, failed: 0 };

  await ensureMasterInstructionsInMemory(site.id ?? null);

  if (allowLocalImage && peerSites?.length) {
    await prewarmSapPeerSiteInventories(peerSites);
  }

  const pageRanges = overviewBulkPageRanges(catalog.length);
  let ok = 0;
  let failed = 0;
  let globalRowNum = 0;

  for (const { start, end, page, pageCount } of pageRanges) {
    const pageCatalog = catalog.slice(start, end);
    setOverviewBulkHarnessPageState({
      batchKey: harnessSetters.batchKey,
      siteId: harnessSetters.siteId,
      page,
      pageCount,
      start,
      end,
      total: catalog.length,
      setBulkOptimizationState: harnessSetters.setBulkOptimizationState,
      setOptimizationProgress: harnessSetters.setOptimizationProgress,
      step: "In Content Image",
    });

    for (const row of pageCatalog) {
      globalRowNum += 1;
      const url = row.url.trim();
      try {
        updateRow(row.index, { status: "ai-in-content-image" });
        harnessSetters.setBulkOptimizationState((prev) => {
          const current = prev[harnessSetters.batchKey];
          if (!current) return prev;
          return {
            ...prev,
            [harnessSetters.batchKey]: {
              ...current,
              currentUrl: url,
              currentIndex: globalRowNum - 1,
              urlStatuses: { ...(current.urlStatuses || {}), [url]: "optimizing" },
            },
          };
        });
        setInContentImageHarnessMessage(
          harnessSetters,
          `In Content Image ${globalRowNum}/${catalog.length}: ${row.title || url}`,
          10 + Math.round(((globalRowNum - 1) / Math.max(catalog.length, 1)) * 85),
        );

        const sourceHtml = resolveOverviewSourceHtml(
          { postContentOptimized: row.html },
          row.html,
        );
        if (!sourceHtml.trim()) {
          failed += 1;
          updateRow(row.index, { status: "error" });
          harnessSetters.setBulkOptimizationState((prev) => {
            const current = prev[harnessSetters.batchKey];
            if (!current) return prev;
            return {
              ...prev,
              [harnessSetters.batchKey]: {
                ...current,
                urlStatuses: { ...(current.urlStatuses || {}), [url]: "error" },
              },
            };
          });
          setInContentImageHarnessMessage(
            harnessSetters,
            "No HTML body for in-content image",
          );
          continue;
        }

        const bodyH2Titles = extractH2TextsFromHtml(sourceHtml).filter(
          (t) => t.trim().toLowerCase() !== "overview",
        );
        emitInContentImageHarnessPayload(
          url,
          harnessSetters,
          makeInContentImageHarnessStartPayload(row.index, IN_CONTENT_STEP_ANALYZE),
        );
        emitInContentImageHarnessPayload(
          url,
          harnessSetters,
          makeInContentImageHarnessDonePayload(
            row.index,
            IN_CONTENT_STEP_ANALYZE,
            formatInContentAnalyzeMarkdown(bodyH2Titles),
          ),
        );

        if (!bodyH2Titles.length) {
          failed += 1;
          updateRow(row.index, { status: "error" });
          harnessSetters.setBulkOptimizationState((prev) => {
            const current = prev[harnessSetters.batchKey];
            if (!current) return prev;
            return {
              ...prev,
              [harnessSetters.batchKey]: {
                ...current,
                urlStatuses: { ...(current.urlStatuses || {}), [url]: "error" },
              },
            };
          });
          setInContentImageHarnessMessage(harnessSetters, "No H2 sections for image placement");
          continue;
        }

        emitInContentImageHarnessPayload(
          url,
          harnessSetters,
          makeInContentImageHarnessStartPayload(row.index, IN_CONTENT_STEP_CHECKLIST),
        );
        emitInContentImageHarnessPayload(
          url,
          harnessSetters,
          makeInContentImageHarnessStartPayload(row.index, IN_CONTENT_STEP_GENERATE),
        );

        const imageKind = row.imageKind === "local" ? "local" : "photo";
        let localPhaseLog = "";
        let result: {
          html: string;
          imageUrl: string;
          mediaId?: number;
          alt: string;
          sectionHeader: string;
          referenceImageUrl?: string;
          referenceSourceUrl?: string;
          entity?: string;
          sharedFromSiteName?: string;
          sharedFromPageUrl?: string;
          reusedFromCrossSite?: boolean;
          peerCsvFiles?: Array<{ name: string; content: string; mimeType: string }>;
        };

        if (imageKind === "local") {
          if (!allowLocalImage) {
            throw new Error("Local Image is only available on SAP (entity) rows");
          }
          const resolvedLocalMode = row.localImageMode === "find" ? "find" : "generate";
          const existingScope =
            resolvedLocalMode === "generate"
              ? row.localImageExistingScope
              : undefined;
          const hasExisting = htmlHasLocalInContentImage(sourceHtml);
          const gate =
            resolvedLocalMode === "generate"
              ? gateLocalImageExistingScope(existingScope, hasExisting)
              : ({ action: "generate", stripExisting: false } as const);

          if (gate.action === "skip") {
            ok += 1;
            updateRow(row.index, { status: "idle" });
            // #region agent log
            fetch('http://127.0.0.1:7781/ingest/50ee427b-23ed-4bec-99ab-67b267c19331',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ae1ef'},body:JSON.stringify({sessionId:'8ae1ef',runId:'post-fix',hypothesisId:'A',location:'overview-blog-in-content-image-harness-run.ts:existing-scope-skip',message:'Marking skipped — Local Image existing scope',data:{url:String(url||'').slice(0,140),title:(row.title||'').slice(0,100),focusKeyword:(row.focusKeyword||'').slice(0,120),skipReason:gate.reason,existingScope:existingScope||'new',hasExisting,htmlLen:sourceHtml.length},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            harnessSetters.setBulkOptimizationState((prev) => {
              const current = prev[harnessSetters.batchKey];
              if (!current) return prev;
              const urlLocalImageOutcomes = {
                ...(current.urlLocalImageOutcomes || {}),
                [url]: "skipped" as const,
              };
              const urlSkipReasons = {
                ...(current.urlSkipReasons || {}),
                [url]: gate.reason,
              };
              const urlGeneratedFiles = { ...(current.urlGeneratedFiles || {}) };
              const summaryFile = rebuildLocalImageBatchSummaryFile({
                urls: current.urls || [],
                urlKeywords: current.urlKeywords,
                urlOutcomes: urlLocalImageOutcomes,
                urlSkipReasons,
                urlGeneratedFiles,
              });
              return {
                ...prev,
                [harnessSetters.batchKey]: {
                  ...current,
                  urlStatuses: { ...(current.urlStatuses || {}), [url]: "skipped" },
                  urlSkipReasons,
                  urlLocalImageOutcomes,
                  batchPeerLibraryFiles: mergeGeneratedFilesByName(
                    current.batchPeerLibraryFiles || [],
                    [summaryFile],
                  ),
                },
              };
            });
            const existing = extractPreferredBodyImageFromHtml(sourceHtml);
            const checklistLabel = hasExisting
              ? "Already has Local Image"
              : "No Local Image to replace";
            emitInContentImageHarnessPayload(
              url,
              harnessSetters,
              makeInContentImageHarnessDonePayload(
                row.index,
                IN_CONTENT_STEP_CHECKLIST,
                checklistLabel,
              ),
            );
            emitInContentImageHarnessPayload(
              url,
              harnessSetters,
              makeInContentImageHarnessDonePayload(
                row.index,
                IN_CONTENT_STEP_GENERATE,
                existing?.url
                  ? `${gate.reason}\n${existing.url}`
                  : gate.reason,
              ),
            );
            emitInContentImageHarnessPayload(
              url,
              harnessSetters,
              makeInContentImageHarnessDonePayload(
                row.index,
                IN_CONTENT_STEP_INSERT,
                hasExisting
                  ? "No insert — Local Image already on page"
                  : "No insert — nothing to replace",
              ),
            );
            setInContentImageHarnessMessage(
              harnessSetters,
              `${gate.reason} ${row.title || url}`,
            );
            continue;
          }

          const htmlForGenerate = gate.stripExisting
            ? stripPreferredBodyImageFromHtml(sourceHtml)
            : sourceHtml;

          const entity = await resolveLocalImagePlaceEntity({
            url,
            title: row.title,
            apiKey,
          });
          // #region agent log
          fetch('http://127.0.0.1:7781/ingest/50ee427b-23ed-4bec-99ab-67b267c19331',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ae1ef'},body:JSON.stringify({sessionId:'8ae1ef',runId:'kw-cache',hypothesisId:'B',location:'overview-blog-in-content-image-harness-run.ts:before-local',message:'Harness calling Generate Local',data:{entity:String(entity||'').slice(0,120),localImageMode:resolvedLocalMode,existingScope:existingScope||'new',stripExisting:gate.stripExisting,rowFocusKeyword:(row.focusKeyword||'').slice(0,120),rowTitle:(row.title||'').slice(0,100),peerSitesPassed:(peerSites??[]).length,peerNames:(peerSites??[]).slice(0,15).map((s)=>((s.name||s.siteUrl||'')+'').slice(0,40)),writeSite:(site.name||site.siteUrl||'').slice(0,40)},timestamp:Date.now()})}).catch(()=>{});
          // #endregion

          const publishPeerPlan = (
            peers: Array<{ name: string; siteUrl: string }>,
          ) => {
            // #region agent log
            fetch('http://127.0.0.1:7781/ingest/50ee427b-23ed-4bec-99ab-67b267c19331',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ae1ef'},body:JSON.stringify({sessionId:'8ae1ef',runId:'empty-peers',hypothesisId:'C',location:'overview-blog-in-content-image-harness-run.ts:publishPeerPlan',message:'Publishing peer plan to Details',data:{url:String(url||'').slice(0,120),entity:String(entity||'').slice(0,80),peerCount:peers.length,peerNames:peers.slice(0,12).map((p)=>p.name.slice(0,40))},timestamp:Date.now()})}).catch(()=>{});
            // #endregion
            const planFile = buildPeerSitesPlanFile({ entity, peers });
            harnessSetters.setBulkOptimizationState((prev) => {
              const current = prev[harnessSetters.batchKey];
              if (!current) return prev;
              // One batch-level plan only (do not attach per keyword).
              if ((current.batchPeerLibraryFiles || []).some((f) => f.name === planFile.name)) {
                return prev;
              }
              return {
                ...prev,
                [harnessSetters.batchKey]: {
                  ...current,
                  batchPeerLibraryFiles: mergeGeneratedFilesByName(
                    current.batchPeerLibraryFiles || [],
                    [planFile],
                  ),
                },
              };
            });
            emitInContentImageHarnessPayload(
              url,
              harnessSetters,
              makeInContentImageHarnessDonePayload(
                row.index,
                IN_CONTENT_STEP_CHECKLIST,
                formatPeerSitesChecklistStatus({
                  entity,
                  peerCount: peers.length,
                }),
              ),
            );
          };

          const attachPeerCsv = (file: {
            name: string;
            content: string;
            mimeType: string;
          }) => {
            harnessSetters.setBulkOptimizationState((prev) => {
              const current = prev[harnessSetters.batchKey];
              if (!current) return prev;
              return {
                ...prev,
                [harnessSetters.batchKey]: {
                  ...current,
                  batchPeerLibraryFiles: mergeGeneratedFilesByName(
                    current.batchPeerLibraryFiles || [],
                    [file],
                  ),
                },
              };
            });
          };

          const publishLocalPhase = (info: {
            phase: "looking" | "found" | "not_found" | "reusing" | "generating";
            detail?: string;
          }) => {
            localPhaseLog = appendLocalImagePhaseLog(localPhaseLog, info);
            emitInContentImageHarnessPayload(
              url,
              harnessSetters,
              makeInContentImageHarnessProgressPayload(
                row.index,
                IN_CONTENT_STEP_GENERATE,
                localPhaseLog,
              ),
            );
            setInContentImageHarnessMessage(
              harnessSetters,
              formatLocalImagePhaseLine(info),
            );
          };

          result = await generateLocalInContentImageFromHtml({
            html: htmlForGenerate,
            site,
            entity,
            pageUrl: url,
            focusKeyword: row.focusKeyword || entity,
            flowTitle: row.title || entity,
            forcedSectionHeader: row.forcedSectionHeader,
            apiKey,
            model,
            peerSites,
            localImageMode: resolvedLocalMode,
            onPeerPlanReady: publishPeerPlan,
            onPeerCsvReady: attachPeerCsv,
            onLocalImagePhase: publishLocalPhase,
            onPeerLibrariesReady: (peerCsvFiles) => {
              // #region agent log
              fetch('http://127.0.0.1:7781/ingest/50ee427b-23ed-4bec-99ab-67b267c19331',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ae1ef'},body:JSON.stringify({sessionId:'8ae1ef',runId:'csv-ui',hypothesisId:'I',location:'overview-blog-in-content-image-harness-run.ts:peer-ready',message:'Early attach peer CSVs before DFS/AI',data:{url:String(url||'').slice(0,120),peerCsvCount:peerCsvFiles.length,peerCsvNames:peerCsvFiles.slice(0,8).map((f)=>f.name)},timestamp:Date.now()})}).catch(()=>{});
              // #endregion
              harnessSetters.setBulkOptimizationState((prev) => {
                const current = prev[harnessSetters.batchKey];
                if (!current) return prev;
                return {
                  ...prev,
                  [harnessSetters.batchKey]: {
                    ...current,
                    batchPeerLibraryFiles: mergeGeneratedFilesByName(
                      current.batchPeerLibraryFiles || [],
                      peerCsvFiles,
                    ),
                  },
                };
              });
            },
          });
        } else {
          result = await generateInContentImageFromHtml({
            html: sourceHtml,
            flowTitle: row.title || row.focusKeyword || url,
            focusKeyword: row.focusKeyword || row.title || "",
            site,
            imageType: "photo",
            apiKey,
            model,
            forcedSectionHeader: row.forcedSectionHeader,
          });
        }

        emitInContentImageHarnessPayload(
          url,
          harnessSetters,
          makeInContentImageHarnessDonePayload(
            row.index,
            IN_CONTENT_STEP_CHECKLIST,
            imageKind === "local"
              ? [
                  formatPeerLocalImageLibraryChecklistMarkdown({
                    entity: result.entity || "",
                    peerFileNames: (result.peerCsvFiles ?? []).map((f) => f.name),
                    reusedFrom: result.reusedFromCrossSite
                      ? result.sharedFromSiteName
                      : undefined,
                  }),
                  result.referenceImageUrl
                    ? result.reusedFromCrossSite
                      ? `\n\nReused from ${result.sharedFromSiteName || "peer site"} SAP page.\n\n${formatLocalImageChecklistMarkdown({
                          entity: result.entity || "",
                          referenceImageUrl: result.referenceImageUrl,
                          referenceSourceUrl:
                            result.sharedFromPageUrl || result.referenceSourceUrl,
                        })}`
                      : `\n\n${formatLocalImageChecklistMarkdown({
                          entity: result.entity || "",
                          referenceImageUrl: result.referenceImageUrl,
                          referenceSourceUrl: result.referenceSourceUrl,
                        })}`
                    : "",
                ].join("")
              : "Checklist built and image generated.",
          ),
        );
        emitInContentImageHarnessPayload(
          url,
          harnessSetters,
          makeInContentImageHarnessDonePayload(
            row.index,
            IN_CONTENT_STEP_GENERATE,
            [
              imageKind === "local" && localPhaseLog.trim()
                ? `${localPhaseLog.trim()}\n\n`
                : "",
              formatInContentImageResultMarkdown({
                sectionHeader: result.sectionHeader,
                imageUrl: result.imageUrl,
                alt: result.alt,
                referenceImageUrl: result.referenceImageUrl,
                referenceSourceUrl:
                  result.sharedFromPageUrl || result.referenceSourceUrl,
                action: result.reusedFromCrossSite
                  ? "Reused peer image"
                  : "Generated from reference",
                entity: result.entity,
                sourceSiteName: result.sharedFromSiteName,
                sourcePageUrl: result.sharedFromPageUrl,
              }),
            ].join(""),
          ),
        );

        emitInContentImageHarnessPayload(
          url,
          harnessSetters,
          makeInContentImageHarnessStartPayload(row.index, IN_CONTENT_STEP_INSERT),
        );
        emitInContentImageHarnessPayload(
          url,
          harnessSetters,
          makeInContentImageHarnessDonePayload(
            row.index,
            IN_CONTENT_STEP_INSERT,
            `Inserted under H2: ${result.sectionHeader}`,
          ),
        );

        const blogH2List = extractH2TextsFromHtml(result.html);
        updateRow(row.index, {
          status: "idle",
          postContent: result.html,
          postContentOptimized: result.html,
          blogH2List,
          blogInContentImageUrl: result.imageUrl,
          blogInContentImageAlt: result.alt,
          blogInContentImageSection: result.sectionHeader,
          blogInContentImageMediaId: result.mediaId ?? null,
          blogInContentImageRanAtIso: new Date().toISOString(),
          blogInContentImageReferenceUrl: result.referenceImageUrl?.trim() || undefined,
          blogInContentImageReferenceSourceUrl:
            result.referenceSourceUrl?.trim() || undefined,
          blogInContentImageSharedFromSiteName:
            result.sharedFromSiteName?.trim() || undefined,
          blogInContentImageSharedFromPageUrl:
            result.sharedFromPageUrl?.trim() || undefined,
        });
        // #region agent log
        fetch('http://127.0.0.1:7781/ingest/50ee427b-23ed-4bec-99ab-67b267c19331',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ae1ef'},body:JSON.stringify({sessionId:'8ae1ef',runId:'csv-ui',hypothesisId:'I',location:'overview-blog-in-content-image-harness-run.ts:attach-ok',message:'Attaching urlGeneratedFiles on success',data:{url:String(url||'').slice(0,120),peerCsvCount:(result.peerCsvFiles??[]).length,peerCsvNames:(result.peerCsvFiles??[]).slice(0,8).map((f)=>f.name),reusedFromCrossSite:Boolean(result.reusedFromCrossSite)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        harnessSetters.setBulkOptimizationState((prev) => {
          const current = prev[harnessSetters.batchKey];
          if (!current) return prev;
          const reportMd = formatInContentImageResultMarkdown({
            sectionHeader: result.sectionHeader,
            imageUrl: result.imageUrl,
            alt: result.alt,
            referenceImageUrl: result.referenceImageUrl,
            referenceSourceUrl:
              result.sharedFromPageUrl || result.referenceSourceUrl,
            action: result.reusedFromCrossSite
              ? "Reused peer image"
              : "Generated from reference",
            entity: result.entity,
            sourceSiteName: result.sharedFromSiteName,
            sourcePageUrl: result.sharedFromPageUrl,
          });
          const urlGeneratedFiles = {
            ...(current.urlGeneratedFiles || {}),
            [url]: mergeGeneratedFilesByName(current.urlGeneratedFiles?.[url] || [], [
              {
                name: "in-content-image.md",
                content: reportMd,
                mimeType: "text/markdown;charset=utf-8",
              },
            ]),
          };
          const urlLocalImageOutcomes = {
            ...(current.urlLocalImageOutcomes || {}),
            [url]: result.reusedFromCrossSite
              ? ("found" as const)
              : ("generated" as const),
          };
          const summaryFile = rebuildLocalImageBatchSummaryFile({
            urls: current.urls || [],
            urlKeywords: current.urlKeywords,
            urlOutcomes: urlLocalImageOutcomes,
            urlSkipReasons: current.urlSkipReasons,
            urlGeneratedFiles,
          });
          return {
            ...prev,
            [harnessSetters.batchKey]: {
              ...current,
              urlStatuses: { ...(current.urlStatuses || {}), [url]: "completed" },
              urlLocalImageOutcomes,
              batchPeerLibraryFiles: mergeGeneratedFilesByName(
                result.peerCsvFiles?.length
                  ? mergeGeneratedFilesByName(
                      current.batchPeerLibraryFiles || [],
                      result.peerCsvFiles,
                    )
                  : current.batchPeerLibraryFiles || [],
                [summaryFile],
              ),
              urlGeneratedFiles,
            },
          };
        });

        onRowOk?.(url, result.html);
        ok += 1;
      } catch (err) {
        failed += 1;
        const message = err instanceof Error ? err.message : String(err);
        const peerCsvFiles =
          err && typeof err === "object" && "peerCsvFiles" in err
            ? (
                err as {
                  peerCsvFiles?: Array<{ name: string; content: string; mimeType: string }>;
                }
              ).peerCsvFiles
            : undefined;
        // #region agent log
        fetch('http://127.0.0.1:7781/ingest/50ee427b-23ed-4bec-99ab-67b267c19331',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'8ae1ef'},body:JSON.stringify({sessionId:'8ae1ef',runId:'csv-ui',hypothesisId:'I',location:'overview-blog-in-content-image-harness-run.ts:attach-err',message:'Error path peer CSV attach',data:{url:String(url||'').slice(0,120),peerCsvCount:peerCsvFiles?.length??0,peerCsvNames:(peerCsvFiles??[]).slice(0,8).map((f)=>f.name),message:String(message||'').slice(0,160)},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        updateRow(row.index, { status: "error" });
        harnessSetters.setBulkOptimizationState((prev) => {
          const current = prev[harnessSetters.batchKey];
          if (!current) return prev;
          const urlLocalImageOutcomes = {
            ...(current.urlLocalImageOutcomes || {}),
            [url]: "error" as const,
          };
          const urlSkipReasons = {
            ...(current.urlSkipReasons || {}),
            [url]: message,
          };
          const summaryFile = rebuildLocalImageBatchSummaryFile({
            urls: current.urls || [],
            urlKeywords: current.urlKeywords,
            urlOutcomes: urlLocalImageOutcomes,
            urlSkipReasons,
            urlGeneratedFiles: current.urlGeneratedFiles,
          });
          return {
            ...prev,
            [harnessSetters.batchKey]: {
              ...current,
              urlStatuses: { ...(current.urlStatuses || {}), [url]: "error" },
              urlLocalImageOutcomes,
              urlSkipReasons,
              batchPeerLibraryFiles: mergeGeneratedFilesByName(
                peerCsvFiles?.length
                  ? mergeGeneratedFilesByName(
                      current.batchPeerLibraryFiles || [],
                      peerCsvFiles,
                    )
                  : current.batchPeerLibraryFiles || [],
                [summaryFile],
              ),
            },
          };
        });
        if (peerCsvFiles?.length) {
          emitInContentImageHarnessPayload(
            url,
            harnessSetters,
            makeInContentImageHarnessDonePayload(
              row.index,
              IN_CONTENT_STEP_CHECKLIST,
              formatPeerLocalImageLibraryChecklistMarkdown({
                entity: row.title || url,
                peerFileNames: peerCsvFiles.map((f) => f.name),
              }),
            ),
          );
        }
        setInContentImageHarnessMessage(harnessSetters, message);
      }
    }
  }

  setInContentImageHarnessMessage(
    harnessSetters,
    `In Content Image finished: ${ok} ok, ${failed} failed`,
    100,
  );

  return { ok, failed };
}
