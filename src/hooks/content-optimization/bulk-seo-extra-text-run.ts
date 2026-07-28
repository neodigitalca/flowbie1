import pLimit from "p-limit";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_NO_TARGETS_COULD_RUN_CHECK_ROW_POST_IDS_, NOTIFY_OPENROUTER_API_KEY_REQUIRED_FOR_SEO_EXTR, NOTIFY_WORDPRESS_SITE_URL_USERNAME_AND_APPLICAT, notifyBulkSeoExtraTextFailedForAllXTar, notifyBulkSeoExtraTextXUploadedBatchstat } from "@/lib/notify-messages";
import { loadApiKey } from "@/lib/api";
import { buildInventoryPostRagContext } from "@/lib/content-generation/inventory-post-rag";
import { generateExtraTextForPage } from "@/lib/content-generation/page-extra-content-generator";
import { buildBulkExtraTextItem } from "@/lib/overview/overview-bulk-extra-text-payload";
import type { OverviewBulkSeoApiItem } from "@/lib/overview/overview-bulk-seo-payload";
import { uploadOverviewSeoApiItemAvoidingBatchV1 } from "@/lib/overview/overview-bulk-seo-payload";
import type { WordPressSite } from "@/components/integrations/types";
import {
  lookupInventoryRowWithSource,
  normalizeMatch,
  typeHintFromCachedPost,
  existingPostFromInventoryRow,
  type BulkOptimizerInventorySnapshot,
} from "@/lib/wordpress-api/inventory-match";
import { buildWordPressPostsForLinkingFromInventory } from "@/lib/content-generation/extra-text-inventory-links";
import { OptimizationFileManager } from "@/lib/optimization-file-manager";
import { finalizeBulkSeoExtraTextHtml } from "./bulk-seo-extra-text-finalize";
import {
  emitExtraTextHarnessPayload,
  refreshExtraTextBatchProgress,
  setExtraTextUrlStatus,
  type ExtraTextHarnessSetters,
} from "./bulk-seo-extra-text-harness";
import { mergeOptimizationProgress } from "./optimization-helpers";
import { bulkOptimizationWpStr as wpStr, BULK_EXTRA_TEXT_GENERATE_CONCURRENCY } from "./bulk-optimization-constants";
import { overviewBulkPageRanges } from "@/lib/overview/overview-bulk-page-size";
import { initOverviewBulkHarnessPagination, setOverviewBulkHarnessPageState } from "@/lib/overview/overview-bulk-page-state";
import type { HandleOptimizeMultipleContentParams, PrefilledOverviewTarget } from "./bulk-optimization-params";

type ResolvedTarget = {
  index: number;
  url: string;
  postId: number;
  postType: string;
  postTypeEndpoint: string;
  primaryKeyword: string;
  existingTitle: string;
  existingContent: string;
  existingExcerpt: string;
  pageRagContext: string;
};

type PendingUpload = {
  target: ResolvedTarget;
  item: OverviewBulkSeoApiItem;
};

function bulkCancelled(
  batchKey: string,
  setBulkOptimizationState: HandleOptimizeMultipleContentParams["setBulkOptimizationState"],
): boolean {
  let cancelled = false;
  setBulkOptimizationState((prev: any) => {
    if (prev[batchKey]?.cancelRequested) cancelled = true;
    return prev;
  });
  return cancelled;
}

function setBatchStep(
  batchKey: string,
  step: string,
  message: string,
  progress: number,
  setBulkOptimizationState: HandleOptimizeMultipleContentParams["setBulkOptimizationState"],
  setOptimizationProgress: HandleOptimizeMultipleContentParams["setOptimizationProgress"],
): void {
  setOptimizationProgress((prev: any) =>
    mergeOptimizationProgress(prev, batchKey, { step, progress, message }),
  );
  setBulkOptimizationState((prev: any) => {
    const current = prev[batchKey];
    if (!current) return prev;
    return {
      ...prev,
      [batchKey]: {
        ...current,
        currentStep: step,
        currentProgress: progress,
        currentStepProgress: { step, progress, message },
      },
    };
  });
}

function resolveTarget(
  site: WordPressSite,
  url: string,
  index: number,
  bulkInventorySnapshot: BulkOptimizerInventorySnapshot | null,
  prefetchedPendingCache: Map<number, { pending: Record<string, unknown>; primaryKeyword: string }>,
  prefetchedAcfFieldsCache: Map<number, Record<string, any>>,
  wordPressPostsForRun: any[],
  prefilledOverviewTargets?: Record<string, PrefilledOverviewTarget>,
): ResolvedTarget | { error: string } {
  const trimmedUrl = url?.trim();
  const prefilled = trimmedUrl ? prefilledOverviewTargets?.[trimmedUrl] : undefined;

  let postId = Number(prefilled?.postId);
  let postType = String(prefilled?.postType ?? "page").trim() || "page";
  let postTypeEndpoint = String(prefilled?.postTypeEndpoint ?? "").trim();
  let existingTitle = "";
  let existingContent = String(prefilled?.content ?? "");
  let existingExcerpt = "";
  const pendingEntry = prefetchedPendingCache.get(index);

  if (prefilled?.postId) {
    const prefilledKw = String(
      prefetchedAcfFieldsCache.get(index)?.["keyword_focus"] ||
        prefilled?.keyword ||
        "",
    ).trim();
    if (!postTypeEndpoint) {
      postTypeEndpoint = postType === "page" ? "pages" : postType === "post" ? "posts" : postType;
    }
    if (!Number.isFinite(postId) || postId <= 0) {
      return { error: "No WordPress post ID on this row. Load sitemap inventory in Overview, then retry." };
    }
    if (!prefilledKw) {
      return { error: "No focus keyword for this URL." };
    }
    return {
      index,
      url,
      postId,
      postType,
      postTypeEndpoint,
      primaryKeyword: prefilledKw,
      existingTitle: existingTitle || prefilledKw,
      existingContent,
      existingExcerpt,
      pageRagContext: "",
    };
  }

  const pending = pendingEntry?.pending as Record<string, any> | undefined;
  const existingPost = (pending?.existingPost ?? null) as Record<string, unknown> | null;

  if (!Number.isFinite(postId) || postId <= 0) {
    postId = Number(existingPost?.id);
  }
  if (!prefilled?.postType) {
    postType = String(existingPost?.postTypeSubtype ?? postType).trim() || postType;
  }
  if (!postTypeEndpoint) {
    postTypeEndpoint = String(existingPost?.postTypeEndpoint ?? "").trim();
  }
  if (!existingTitle) existingTitle = wpStr(existingPost?.title);
  if (!existingContent) existingContent = wpStr(existingPost?.content);
  if (!existingExcerpt) existingExcerpt = wpStr(existingPost?.excerpt);

  const targetNorm = normalizeMatch(site.siteUrl, url);
  const cached = wordPressPostsForRun.find(
    (p: any) => p?.link && normalizeMatch(site.siteUrl, p.link) === targetNorm,
  );
  const hint = typeHintFromCachedPost(cached);
  const invHit = bulkInventorySnapshot
    ? lookupInventoryRowWithSource(bulkInventorySnapshot, site.siteUrl, url, hint)
    : undefined;

  if (invHit?.row?.id) {
    const fromInv = existingPostFromInventoryRow(invHit);
    postId = Number(fromInv.id);
    postType = String(fromInv.postTypeSubtype ?? postType);
    postTypeEndpoint = String(fromInv.postTypeEndpoint ?? postTypeEndpoint);
    if (!existingTitle) existingTitle = wpStr(fromInv.title);
    if (!existingContent) existingContent = wpStr(fromInv.content);
    if (!existingExcerpt) existingExcerpt = wpStr(fromInv.excerpt);
  }

  if (!postTypeEndpoint) {
    postTypeEndpoint = postType === "page" ? "pages" : postType === "post" ? "posts" : postType;
  }

  if (!Number.isFinite(postId) || postId <= 0) {
    return { error: "No WordPress post ID on this row. Refresh sitemap inventory once, then retry." };
  }

  const prefilledKw = String(prefilled?.keyword ?? "").trim();
  const acfKw = String(prefetchedAcfFieldsCache.get(index)?.["keyword_focus"] ?? "").trim();
  const pendingKw = String(pendingEntry?.primaryKeyword ?? "").trim();
  const primaryKeyword = (acfKw || prefilledKw || pendingKw).trim();
  if (!primaryKeyword) {
    return { error: "No focus keyword for this URL." };
  }

  const pageRagContext = buildInventoryPostRagContext(invHit?.row);
  const contentForPrompt =
    existingContent.trim() ||
    (invHit?.row?.fields?.content ? String(invHit.row.fields.content) : "");

  return {
    index,
    url,
    postId,
    postType,
    postTypeEndpoint,
    primaryKeyword,
    existingTitle: existingTitle || primaryKeyword,
    existingContent: contentForPrompt,
    existingExcerpt,
    pageRagContext,
  };
}

export interface RunBulkSeoExtraTextBatchParams {
  site: WordPressSite;
  urls: string[];
  batchKey: string;
  muteToasts: boolean;
  stagingSite?: boolean;
  bulkInventorySnapshot: BulkOptimizerInventorySnapshot | null;
  prefetchedPendingCache: Map<number, { pending: Record<string, unknown>; primaryKeyword: string }>;
  prefetchedAcfFieldsCache: Map<number, Record<string, any>>;
  wordPressPostsForRun: any[];
  prefilledOverviewTargets?: Record<string, PrefilledOverviewTarget>;
  fileManager: OptimizationFileManager;
  recordGeneratedFilesForUrl?: (siteId: string, url: string) => void;
  setBulkOptimizationState: HandleOptimizeMultipleContentParams["setBulkOptimizationState"];
  setOptimizationProgress: HandleOptimizeMultipleContentParams["setOptimizationProgress"];
}

export async function runBulkSeoExtraTextBatch(p: RunBulkSeoExtraTextBatchParams): Promise<void> {
  const {
    site,
    urls,
    batchKey,
    muteToasts,
    bulkInventorySnapshot,
    prefetchedPendingCache,
    prefetchedAcfFieldsCache,
    wordPressPostsForRun,
    prefilledOverviewTargets,
    stagingSite = false,
    fileManager,
    recordGeneratedFilesForUrl,
    setBulkOptimizationState,
    setOptimizationProgress,
  } = p;

  if (!site.siteUrl?.trim() || !site.username?.trim() || !site.appPassword?.trim()) {
    if (!muteToasts) {
      notify.error(NOTIFY_WORDPRESS_SITE_URL_USERNAME_AND_APPLICAT);
    }
    return;
  }

  const apiKey = loadApiKey();
  if (!apiKey?.trim()) {
    if (!muteToasts) notify.error(NOTIFY_OPENROUTER_API_KEY_REQUIRED_FOR_SEO_EXTR);
    return;
  }

  const total = urls.length;
  const resolved: ResolvedTarget[] = [];
  const resolveErrors: { url: string; error: string }[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    if (!url) continue;
    const r = resolveTarget(
      site,
      url,
      i,
      bulkInventorySnapshot,
      prefetchedPendingCache,
      prefetchedAcfFieldsCache,
      wordPressPostsForRun,
      prefilledOverviewTargets,
    );
    if ("error" in r) {
      resolveErrors.push({ url, error: r.error });
      setExtraTextUrlStatus(batchKey, url, "error", setBulkOptimizationState, r.error);
    } else {
      resolved.push(r);
    }
  }

  if (resolved.length === 0) {
    if (!muteToasts) notify.error(NOTIFY_NO_TARGETS_COULD_RUN_CHECK_ROW_POST_IDS_);
    setBatchStep(batchKey, "Batch complete", "No runnable targets.", 100, setBulkOptimizationState, setOptimizationProgress);
    return;
  }

  const harnessSetters: ExtraTextHarnessSetters = {
    siteId: site.id,
    batchKey,
    setBulkOptimizationState,
    setOptimizationProgress,
  };

  setBatchStep(
    batchKey,
    "Generating extra text",
    `Generating extra text for ${resolved.length} target(s)…`,
    15,
    setBulkOptimizationState,
    setOptimizationProgress,
  );
  initOverviewBulkHarnessPagination(batchKey, urls.length, setBulkOptimizationState);

  let postsForLinks = wordPressPostsForRun
    .filter((p: { link?: string; title?: string }) => p?.link && p?.title)
    .map((p: { id?: number; slug?: string; title: string; excerpt?: string; link: string; date_gmt?: string }) => ({
      id: Number(p.id) || 0,
      slug: String(p.slug ?? ""),
      title: String(p.title),
      excerpt: String(p.excerpt ?? ""),
      link: String(p.link),
      date_gmt: String(p.date_gmt ?? ""),
    }));

  if (postsForLinks.length === 0 && bulkInventorySnapshot) {
    postsForLinks = buildWordPressPostsForLinkingFromInventory(bulkInventorySnapshot, site.siteUrl);
  }

  const pendingUploads: PendingUpload[] = [];
  let generateFailCount = 0;
  const pageRanges = overviewBulkPageRanges(resolved.length);

  for (const { start, end, page, pageCount } of pageRanges) {
    if (bulkCancelled(batchKey, setBulkOptimizationState)) break;

    setOverviewBulkHarnessPageState({
      batchKey,
      siteId: site.id,
      page,
      pageCount,
      start,
      end,
      total: resolved.length,
      setBulkOptimizationState,
      setOptimizationProgress,
      step: "Generating extra text",
    });

    const pageResolved = resolved.slice(start, end);
    const limit = pLimit(BULK_EXTRA_TEXT_GENERATE_CONCURRENCY);

    await Promise.all(
      pageResolved.map((t) =>
        limit(async () => {
          if (bulkCancelled(batchKey, setBulkOptimizationState)) return;

          setExtraTextUrlStatus(batchKey, t.url, "optimizing", setBulkOptimizationState);

          try {
            const extra = await generateExtraTextForPage({
              existingContent: t.existingContent,
              primaryKeyword: t.primaryKeyword,
              secondaryKeywords: [],
              pageUrl: t.url,
              pageTitle: t.existingTitle,
              wordPressRAGContext: t.pageRagContext,
              wordPressPosts: postsForLinks,
              site,
              apiKey,
              siteId: site.id,
              onHarnessSection: (payload) => emitExtraTextHarnessPayload(t.url, payload, harnessSetters),
            });

            if (!extra?.trim()) {
              generateFailCount += 1;
              setExtraTextUrlStatus(
                batchKey,
                t.url,
                "error",
                setBulkOptimizationState,
                "Extra text generation returned empty.",
              );
              return;
            }

            const { html: linkedExtra } = await finalizeBulkSeoExtraTextHtml({
              extraTextHtml: extra,
              currentPageUrl: t.url,
              siteUrl: site.siteUrl,
              siteId: site.id,
              apiKey,
              wordPressPosts: postsForLinks,
              stagingSite,
              skipLinkPipeline: true,
              onProgress: () => {},
            });

            if (!linkedExtra) {
              generateFailCount += 1;
              setExtraTextUrlStatus(
                batchKey,
                t.url,
                "error",
                setBulkOptimizationState,
                "Extra text empty after link ensure and validation.",
              );
              return;
            }

            const item = buildBulkExtraTextItem({
              postId: t.postId,
              postType: t.postType,
              postTypeEndpoint: t.postTypeEndpoint,
              extraTextRaw: linkedExtra,
            });
            if (!item) {
              generateFailCount += 1;
              setExtraTextUrlStatus(
                batchKey,
                t.url,
                "error",
                setBulkOptimizationState,
                "Could not build ACF payload.",
              );
              return;
            }

            pendingUploads.push({ target: t, item });
          } catch (e) {
            generateFailCount += 1;
            console.warn(`[Bulk SEO extra text] Generate failed for ${t.url}:`, e);
            setExtraTextUrlStatus(
              batchKey,
              t.url,
              "error",
              setBulkOptimizationState,
              e instanceof Error ? e.message : "Extra text generation failed",
            );
          } finally {
            refreshExtraTextBatchProgress(
              batchKey,
              "Generating extra text",
              `Generated ${pendingUploads.length + generateFailCount}/${resolved.length}…`,
              harnessSetters,
            );
          }
        }),
      ),
    );
  }

  if (bulkCancelled(batchKey, setBulkOptimizationState)) return;

  const batchStats = { uploadOk: 0, uploadFail: generateFailCount + resolveErrors.length };

  if (pendingUploads.length === 0) {
    setBatchStep(
      batchKey,
      "Batch complete",
      `No rows to upload (${batchStats.uploadFail} failed).`,
      100,
      setBulkOptimizationState,
      setOptimizationProgress,
    );
    if (!muteToasts) {
      notify.error(notifyBulkSeoExtraTextFailedForAllXTar(batchStats.uploadFail));
    }
    return;
  }

  const uploadTotal = pendingUploads.length;
  const uploadPageRanges = overviewBulkPageRanges(uploadTotal);
  let bulkApiCallCount = 0;

  try {
    for (const { start, end, page, pageCount } of uploadPageRanges) {
      const chunk = pendingUploads.slice(start, end);

      setBatchStep(
        batchKey,
        "Uploading to WordPress",
        uploadPageRanges.length > 1
          ? `Uploading page ${page}/${pageCount}: rows ${start + 1}–${end} of ${uploadTotal}…`
          : `Uploading ${uploadTotal} row(s) via single-post PUT…`,
        92 + Math.round((page / pageCount) * 6),
        setBulkOptimizationState,
        setOptimizationProgress,
      );

      for (let localIdx = 0; localIdx < chunk.length; localIdx += 1) {
        const { target, item } = chunk[localIdx]!;
        bulkApiCallCount += 1;
        let result: Awaited<ReturnType<typeof uploadOverviewSeoApiItemAvoidingBatchV1>>;
        try {
          result = await uploadOverviewSeoApiItemAvoidingBatchV1(site, item);
        } catch (itemErr) {
          result = {
            postId: item.postId,
            ok: false,
            error: itemErr instanceof Error ? itemErr.message : "WordPress upload failed",
            method: "direct_put",
          };
        }

        if (result.ok) {
          batchStats.uploadOk += 1;
          const uploadConfirmationFileName = OptimizationFileManager.generateFilename(
            "wordpress-post-upload",
            String(target.postId),
            "json",
          );
          fileManager.addFile(
            uploadConfirmationFileName,
            JSON.stringify(
              {
                success: true,
                postId: target.postId,
                link: target.url,
                finalTitle: target.existingTitle,
                status: "published",
                updateMode: "update",
                url: target.url,
                uploadedAt: new Date().toISOString(),
                wordpressSite: site.siteUrl || site.name || null,
                bulkSeoExtraTextOnly: true,
                result,
              },
              null,
              2,
            ),
            "application/json",
          );
          recordGeneratedFilesForUrl?.(site.id, target.url);
          setExtraTextUrlStatus(batchKey, target.url, "completed", setBulkOptimizationState);
        } else {
          batchStats.uploadFail += 1;
          const err = result.error?.trim() || "WordPress rejected the ACF update.";
          setExtraTextUrlStatus(batchKey, target.url, "error", setBulkOptimizationState, err);
        }
      }
    }
  } catch (uploadErr) {
    const msg = uploadErr instanceof Error ? uploadErr.message : "WordPress bulk upload failed";
    console.error("[Bulk SEO extra text] Bulk upload failed:", uploadErr);
    for (const { target } of pendingUploads) {
      batchStats.uploadFail += 1;
      setExtraTextUrlStatus(batchKey, target.url, "error", setBulkOptimizationState, msg);
    }
  }

  setBulkOptimizationState((prev: any) => {
    const current = prev[batchKey];
    if (!current) return prev;
    return {
      ...prev,
      [batchKey]: {
        ...current,
        currentStep: "Batch complete",
        currentProgress: 100,
        warmingUpIndex: null,
        warmingUpIndex2: null,
        currentStepProgress: {
          step: "Batch complete",
          progress: 100,
          message: `${batchStats.uploadOk} uploaded, ${batchStats.uploadFail} failed (${total} targets).`,
        },
      },
    };
  });

  setOptimizationProgress((prev: any) =>
    mergeOptimizationProgress(prev, batchKey, {
      step: "Batch complete",
      progress: 100,
      message: `${batchStats.uploadOk} uploaded, ${batchStats.uploadFail} failed`,
    }),
  );

  if (!muteToasts) {
    if (batchStats.uploadOk > 0) {
      notify.success(
        `Bulk SEO extra text: ${batchStats.uploadOk} uploaded${batchStats.uploadFail > 0 ? `, ${batchStats.uploadFail} failed` : ""}.`,
      );
    } else {
      notify.error(notifyBulkSeoExtraTextFailedForAllXTar(batchStats.uploadFail));
    }
  }
}
