import { useCallback, useRef, type RefObject } from "react";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { WordPressSite } from "@/components/integrations/types";
import type { OverviewBinding } from "@/hooks/overview/use-overview-wordpress-binding";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import type { OverviewInventoryUrlMatch } from "@/lib/overview/overview-row-scrape";
import { resolveOverviewBindingForRow } from "@/lib/overview/overview-bulk-seo-payload";
import { resolveWordPressUrls } from "@/lib/wordpress-api/posts";
import { normalizePageUrlKey } from "@/lib/sitemap-optimizer/normalize-page-url";
import type { ElementorHarnessKind } from "@/lib/elementor-page-content/detect-harness-slots";
import { hydrateElementorRow } from "@/lib/elementor-page-content/hydrate-elementor-row";
import { siteReadyForElementorApi } from "@/lib/elementor-api";
import {
  runElementorHarnessRow,
  shouldUseElementorPageHarness,
} from "@/lib/elementor-page-content/run-elementor-harness-row";
import {
  finalizeOverviewScenarioHarnessBatch,
  initOverviewScenarioHarnessRowState,
} from "@/lib/overview/overview-blog-scenario-harness-run";
import { finishScenarioRowHarness } from "@/lib/overview/overview-blog-scenario-harness-mutations";
import { createAiseoCacheWriteAccumulator } from "@/lib/overview/overview-aiseo-cache-write";
import {
  patchElementorSectionInJson,
  sectionOutlineFromJson,
} from "@/lib/elementor-page-content/apply-elementor-section-copy";
import { runElementorSectionLinkSuggest } from "@/lib/elementor-page-content/run-elementor-section-link-suggest";
import { elementorSectionHeadersFromCachedRow } from "@/lib/elementor-page-content/elementor-section-headers-from-cache";
import {
  appendInternalLinkToHtml,
  patchSectionLinkAtIndex,
} from "@/lib/overview/overview-blog-links-apply-local";
import { extractAllSectionLinkRowsFromHtml } from "@/lib/overview/overview-blog-links-extract";
import { updateOptimizationProgress } from "@/hooks/content-optimization/optimization-helpers-a";
import type { OverviewTabBase } from "@/hooks/overview/use-overview-tab-base";

type Args = Pick<OverviewTabBase, "updateRow" | "opt"> & {
  site: WordPressSite | undefined;
  sitemapSource: OverviewSitemapSource;
  rowsRef: RefObject<OverviewRow[]>;
  bindingsRef: RefObject<Record<string, OverviewBinding | undefined>>;
  getInventoryMatchForUrl: (
    site: WordPressSite | null,
    url: string,
  ) => OverviewInventoryUrlMatch | undefined;
  apiKey: string;
  selectedModel: string;
};

export function useOverviewTabElementorHarness({
  site,
  sitemapSource,
  rowsRef,
  bindingsRef,
  getInventoryMatchForUrl,
  updateRow,
  opt,
  apiKey,
  selectedModel,
}: Args) {
  const hydrateInflightRef = useRef(new Map<string, Promise<boolean>>());

  const sectionTitleForId = useCallback((row: OverviewRow, sectionId: string): string | undefined => {
    return elementorSectionHeadersFromCachedRow(row).find((section) => section.id === sectionId)
      ?.title;
  }, []);

  const hydrateRowAtIndex = useCallback(
    async (index: number): Promise<boolean> => {
      if (!site || !siteReadyForElementorApi(site)) return false;
      const row = rowsRef.current[index];
      const url = row?.url?.trim();
      if (!url) return false;
      if (row.elementorDataJson?.trim()) return true;
      if (sitemapSource !== "pages") return false;

      const urlKey = normalizePageUrlKey(url);
      const inflight = hydrateInflightRef.current.get(urlKey);
      if (inflight) return inflight;

      const job = (async (): Promise<boolean> => {
        const invMatch = getInventoryMatchForUrl(site, url);
        const binding = resolveOverviewBindingForRow(row, bindingsRef.current, invMatch);
        let postId = binding?.postId ?? row.postId ?? null;

        if (!postId) {
          try {
            const resolved = await resolveWordPressUrls(
              site.siteUrl,
              site.username,
              site.appPassword,
              [url],
            );
            const targetKey = normalizePageUrlKey(url);
            const hit = resolved.resolved.find(
              (entry) => normalizePageUrlKey(entry.url) === targetKey,
            );
            if (hit?.id) postId = hit.id;
          } catch {
            // Fall back to slug lookup inside hydrateElementorRow.
          }
        }

        try {
          const { patch } = await hydrateElementorRow(site, url, {
            siteId: site.id,
            postId,
            skipBreakdown: true,
          });
          updateRow(index, patch);
          return true;
        } catch {
          return false;
        }
      })();

      hydrateInflightRef.current.set(urlKey, job);
      try {
        return await job;
      } finally {
        hydrateInflightRef.current.delete(urlKey);
      }
    },
    [site, sitemapSource, rowsRef, bindingsRef, getInventoryMatchForUrl, updateRow],
  );

  const runHarness = useCallback(
    async (
      index: number,
      kind: ElementorHarnessKind,
      targetSectionId?: string,
      targetSectionTitle?: string,
    ) => {
      if (!site?.id || !apiKey?.trim()) return;

      const needsElementorJson =
        kind === "section-header" ||
        kind === "section-content" ||
        kind === "section" ||
        kind === "full-page" ||
        kind === "scenario";
      if (needsElementorJson) {
        await hydrateRowAtIndex(index);
      }

      const row = rowsRef.current[index];
      if (!row?.url?.trim()) return;

      const batchKey = site.id ? `${site.id}-batch` : "";
      const scenarioHarnessSetters =
        kind === "scenario" && site.id
          ? {
              siteId: site.id,
              batchKey,
              setBulkOptimizationState: opt.setBulkOptimizationState,
              setOptimizationProgress: opt.setOptimizationProgress,
            }
          : null;

      if (kind === "scenario" && scenarioHarnessSetters) {
        initOverviewScenarioHarnessRowState({
          site,
          row,
          setBulkOptimizationState: opt.setBulkOptimizationState,
          setOptimizationProgress: opt.setOptimizationProgress,
          setIsOptimizingContent: opt.setIsOptimizingContent,
        });
      }

      updateRow(index, { contentFormat: "elementor" });

      const statusByKind: Record<ElementorHarnessKind, OverviewRow["status"]> = {
        answer: "ai-answer",
        overview: "ai-overview",
        scenario: "ai-scenario",
        links: "ai-links",
        wikipedia: "ai-wikipedia-link",
        headers: "ai-headers",
        "section-header": "ai-headers",
        "section-content": "ai-headers",
        "full-page": "scraping",
        section: "ai-headers",
      };

      updateRow(index, { status: statusByKind[kind] });
      if (site.id) {
        const progressMessage =
          kind === "section-content" || kind === "section"
            ? "Rewriting section body…"
            : kind === "section-header"
              ? "Rewriting section heading…"
              : "Running Elementor AI…";
        updateOptimizationProgress(
          opt.setOptimizationProgress,
          site.id,
          "write",
          0.1,
          progressMessage,
          { pageUrl: row.url },
        );
      }

      const cacheWrite =
        kind === "scenario" && site ? createAiseoCacheWriteAccumulator(site) : null;

      try {
        const harnessResult = await runElementorHarnessRow({
          site,
          row: rowsRef.current[index] ?? row,
          index,
          kind,
          apiKey,
          model: selectedModel,
          targetSectionId,
          targetSectionTitle,
          updateRow,
        });
        if (kind === "scenario" && scenarioHarnessSetters && harnessResult.scenarioArtifact) {
          finishScenarioRowHarness(
            row.url.trim(),
            index,
            harnessResult.scenarioArtifact,
            scenarioHarnessSetters,
            cacheWrite!,
            updateRow,
            "",
          );
        }
        updateRow(index, { status: "idle" });
      } catch {
        updateRow(index, { status: "idle" });
      } finally {
        if (kind === "scenario" && site?.id) {
          finalizeOverviewScenarioHarnessBatch(
            batchKey,
            site.id,
            opt.setIsOptimizingContent,
            opt.setOptimizationProgress,
          );
        }
      }
    },
    [
      site,
      rowsRef,
      updateRow,
      apiKey,
      selectedModel,
      hydrateRowAtIndex,
      opt.setOptimizationProgress,
      opt.setBulkOptimizationState,
      opt.setIsOptimizingContent,
    ],
  );

  const handleAiElementorSectionHeaderRow = useCallback(
    async (index: number, sectionId: string) => {
      const row = rowsRef.current[index];
      const sectionTitle = row ? sectionTitleForId(row, sectionId) : undefined;
      await runHarness(index, "section-header", sectionId, sectionTitle);
    },
    [runHarness, rowsRef, sectionTitleForId],
  );

  const handleAiElementorSectionContentRow = useCallback(
    async (index: number, sectionId: string) => {
      const row = rowsRef.current[index];
      const sectionTitle = row ? sectionTitleForId(row, sectionId) : undefined;
      await runHarness(index, "section-content", sectionId, sectionTitle);
    },
    [runHarness, rowsRef, sectionTitleForId],
  );

  const handleAiElementorSectionLinkRow = useCallback(
    async (index: number, sectionId: string, linkIndex: number) => {
      if (!site || !apiKey?.trim()) return;
      await hydrateRowAtIndex(index);
      const row = rowsRef.current[index];
      if (!row?.url?.trim()) return;

      updateRow(index, { status: "ai-links", contentFormat: "elementor" });
      try {
        const result = await runElementorSectionLinkSuggest({
          site,
          row,
          sectionId,
          linkIndex,
          apiKey,
          model: selectedModel,
        });
        if (!result) return;

        const elementorJson = row.elementorDataJson?.trim();
        if (!elementorJson) return;
        const sections = sectionOutlineFromJson(elementorJson);
        const section = sections.find((entry) => entry.id === sectionId);
        if (!section) return;

        const bodyHtml = section.bodyHtml?.trim() || section.bodyText?.trim() || "";
        const sectionLinks = extractAllSectionLinkRowsFromHtml(bodyHtml);
        const nextHtml =
          linkIndex < sectionLinks.length
            ? patchSectionLinkAtIndex(bodyHtml, linkIndex, {
                anchor: result.anchor,
                href: result.href,
              })
            : appendInternalLinkToHtml(bodyHtml, result.anchor, result.href);

        const nextJson = patchElementorSectionInJson(elementorJson, sectionId, { bodyText: nextHtml });
        const headers = sectionOutlineFromJson(nextJson);
        updateRow(index, {
          contentFormat: "elementor",
          elementorDataJson: nextJson,
          elementorSectionHeaders: headers,
          blogH2List: headers.map((entry) => entry.title),
        });
      } finally {
        updateRow(index, { status: "idle" });
      }
    },
    [site, rowsRef, updateRow, apiKey, selectedModel, hydrateRowAtIndex],
  );

  const handleAiElementorHeadersRow = useCallback(
    async (index: number) => {
      await runHarness(index, "headers");
    },
    [runHarness],
  );

  const handleAiElementorFullPageRow = useCallback(
    async (index: number) => {
      await runHarness(index, "full-page");
    },
    [runHarness],
  );

  const handleAiElementorSectionRow = useCallback(
    async (index: number, sectionId: string) => {
      const row = rowsRef.current[index];
      const sectionTitle = row ? sectionTitleForId(row, sectionId) : undefined;
      await runHarness(index, "section-content", sectionId, sectionTitle);
    },
    [runHarness, rowsRef, sectionTitleForId],
  );

  return {
    hydrateRowAtIndex,
    runHarness,
    handleAiElementorSectionRow,
    handleAiElementorSectionHeaderRow,
    handleAiElementorSectionContentRow,
    handleAiElementorSectionLinkRow,
    handleAiElementorHeadersRow,
    handleAiElementorFullPageRow,
    shouldUseElementorPageHarness: (row: OverviewRow) =>
      shouldUseElementorPageHarness(sitemapSource, row),
  };
}
