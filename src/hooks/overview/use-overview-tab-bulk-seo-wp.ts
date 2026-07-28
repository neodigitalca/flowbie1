import { useCallback } from "react";
import { flushSync } from "react-dom";

import { notify, notifyHeaderError } from "@/lib/app-notifications";
import {
  NOTIFY_CONNECT_A_WORDPRESS_SITE_FIRST_IN_THE_IN,
  NOTIFY_CSV_DOWNLOADED,
  NOTIFY_NO_ROWS_MATCHED_WORDPRESS_INVENTORY,
} from "@/lib/notify-messages";

import { resolveOverviewBindingForRow } from "@/lib/overview/overview-bulk-seo-payload";

import {
  buildOverviewWordPressExportCsv,
  filterOverviewRowsWithPostBinding,
  triggerOverviewCsvDownload,
} from "@/lib/overview/overview-wordpress-export-csv";

import type { WordPressSite } from "@/components/integrations/types";

import type { OverviewTabBase } from "@/hooks/overview/use-overview-tab-base";
import {
  overviewInventoryCollectionsForSite,
  type OverviewSitemapSource,
} from "@/lib/overview/overview-sitemap-source";
import type { useWordPressOptimization } from "@/contexts/wordpress-optimization-context";
import {
  buildWpUploadEligibleRows,
  runOverviewWpUploadBatch,
} from "@/lib/overview/overview-wp-upload-batch";
import { overviewRowsInBulkScope } from "@/lib/overview/overview-bulk-row-scope";
import type { OverviewInventoryUrlMatch } from "@/lib/overview/overview-row-scrape";
import {
  finalizeOverviewWpUploadHarnessBatch,
  initOverviewWpUploadHarnessBatchState,
  type WpUploadHarnessSetters,
} from "@/lib/overview/overview-wp-upload-harness-run";

type Opt = ReturnType<typeof useWordPressOptimization>;

type Args = Pick<
  OverviewTabBase,
  | "rows"
  | "bindings"
  | "resolveBindings"
  | "prefetchOverviewInventory"
  | "setBulkSeoCsvExportBusy"
  | "bulkScopeUrlKeys"
  | "setBulkActionProgress"
> & {
  site: WordPressSite | undefined;
  sitemapSource: OverviewSitemapSource;
  opt: Opt;
  getInventoryMatchForUrl: (
    site: WordPressSite | null,
    url: string,
  ) => OverviewInventoryUrlMatch | undefined;
};

export function useOverviewTabBulkSeoWp({
  site,
  sitemapSource,
  rows,
  bindings,
  resolveBindings,
  prefetchOverviewInventory,
  setBulkSeoCsvExportBusy,
  opt,
  bulkScopeUrlKeys,
  setBulkActionProgress,
  getInventoryMatchForUrl,
}: Args) {
  const inventoryCollections = overviewInventoryCollectionsForSite(site, sitemapSource);

  const handleBulkExportSeoCsv = useCallback(async () => {
    if (!site) {
      notify.error(NOTIFY_CONNECT_A_WORDPRESS_SITE_FIRST_IN_THE_IN);
      return;
    }
    const scopedRows = overviewRowsInBulkScope(rows, bulkScopeUrlKeys);
    if (!scopedRows.length) return;

    setBulkSeoCsvExportBusy(true);
    try {
      const inv = await prefetchOverviewInventory(site, {
        downloadCsv: false,
        collections: inventoryCollections,
      });
      if (!inv.ok) {
        notify.error(inv.error || "Could not load WordPress inventory for export.", { duration: 12000 });
        return;
      }

      const bindingMap = await resolveBindings(rows.map((r) => r.url), site, undefined, {
        inventoryOnly: true,
      });
      const merged = { ...bindings, ...bindingMap };
      const exportRows = scopedRows;
      const eligible = filterOverviewRowsWithPostBinding(exportRows, merged);
      if (!eligible.length) {
        notify.error(NOTIFY_NO_ROWS_MATCHED_WORDPRESS_INVENTORY);
        return;
      }

      const hostKey = (() => {
        try {
          return new URL(site.siteUrl).hostname.replace(/[^a-zA-Z0-9._-]+/g, "_");
        } catch {
          return "site";
        }
      })();
      const csv = buildOverviewWordPressExportCsv(exportRows, merged);
      triggerOverviewCsvDownload(
        csv,
        `flowbie-overview-export-${hostKey}-${new Date().toISOString().slice(0, 10)}.csv`,
      );

      notify.success(NOTIFY_CSV_DOWNLOADED, { duration: 8000 });
    } catch (err) {
      notifyHeaderError("Bulk SEO export failed", err, { duration: 12000 });
    } finally {
      setBulkSeoCsvExportBusy(false);
    }
  }, [site, rows, bulkScopeUrlKeys, bindings, resolveBindings, prefetchOverviewInventory, inventoryCollections, setBulkSeoCsvExportBusy]);

  const handleBulkUploadToWordPress = useCallback(async () => {
    if (!site?.username || !site.appPassword) return;

    const scopedRows = overviewRowsInBulkScope(rows, bulkScopeUrlKeys);
    if (!scopedRows.length) return;

    const mergedBindings = { ...bindings };
    const missingBindingUrls = scopedRows
      .filter((row) => !resolveOverviewBindingForRow(row, mergedBindings, getInventoryMatchForUrl(site, row.url))?.postId)
      .map((row) => row.url);
    if (missingBindingUrls.length) {
      const bindingMap = await resolveBindings(missingBindingUrls, site, undefined, {
        inventoryOnly: true,
      });
      Object.assign(mergedBindings, bindingMap);
    }

    const eligible = buildWpUploadEligibleRows(rows, mergedBindings, bulkScopeUrlKeys, null, {
      resolveBinding: (row) =>
        resolveOverviewBindingForRow(row, mergedBindings, getInventoryMatchForUrl(site, row.url)),
    });

    const batchKey = `${site.id}-batch`;
    const harnessSetters: WpUploadHarnessSetters = {
      siteId: site.id,
      batchKey,
      setBulkOptimizationState: opt.setBulkOptimizationState,
      setOptimizationProgress: opt.setOptimizationProgress,
    };

    const harnessRows = eligible.map((e) => e.row);

    flushSync(() => {
      setBulkActionProgress((p) => {
        const next = { ...p };
        delete next.contentKw;
        delete next.entityKw;
        return next;
      });
      initOverviewWpUploadHarnessBatchState({
        site,
        rows: harnessRows,
        bindings: mergedBindings,
        prepMessage: `Uploading ${eligible.length} row(s) to WordPress…`,
        setBulkOptimizationState: opt.setBulkOptimizationState,
        setOptimizationProgress: opt.setOptimizationProgress,
        setIsOptimizingContent: opt.setIsOptimizingContent,
      });
    });

    if (!eligible.length) {
      finalizeOverviewWpUploadHarnessBatch(
        batchKey,
        site.id,
        harnessSetters,
        opt.setIsOptimizingContent,
        "No scoped rows with WordPress post IDs",
      );
      return;
    }

    try {
      const { stats } = await runOverviewWpUploadBatch({
        site,
        eligible,
        harnessSetters,
        batchKey,
      });

      const { okCount, failCount } = stats;

      finalizeOverviewWpUploadHarnessBatch(
        batchKey,
        site.id,
        harnessSetters,
        opt.setIsOptimizingContent,
        failCount > 0 ? `${okCount} uploaded, ${failCount} failed` : `${okCount} uploaded`,
      );
    } catch (e) {
      finalizeOverviewWpUploadHarnessBatch(
        batchKey,
        site.id,
        harnessSetters,
        opt.setIsOptimizingContent,
        "Upload failed",
      );
      notify.error(e instanceof Error ? e.message : "Bulk WordPress update failed.", { duration: 12000 });
    }
  }, [
    site,
    rows,
    bindings,
    bulkScopeUrlKeys,
    resolveBindings,
    getInventoryMatchForUrl,
    opt,
    setBulkActionProgress,
  ]);

  return { handleBulkExportSeoCsv, handleBulkUploadToWordPress };
}
