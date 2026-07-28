import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { WordPressSite } from "@/components/integrations/types";

import { loadApiKey, loadDataForSEOApiKey } from "@/lib/api";

import { buildWordPressPostingFromSelection } from "@/lib/build-wordpress-bulk-posting";

import { useBulkAutoGenerate, type BulkHarnessSectionUi } from "@/hooks/use-bulk-auto-generate";

import { getResearchModel } from "@/lib/optimization-settings-storage";

import {

  buildMergePublishContracts,

  mergeContractToCsvRow,

  type SitemapMergePublishContract,

} from "@/lib/sitemap-optimizer/sitemap-merge-publish-contract";

import {

  publishedLinkFromRowFiles,

  resolveSitemapMergeSitemapType,

  sitemapRowUrlKey,

} from "@/lib/sitemap-optimizer/sitemap-merge-bulk-state";

import type { SitemapOptimizerRunResult } from "@/lib/sitemap-optimizer/types";



export function useSitemapMergeBulkPublish(site: WordPressSite | null) {

  const openRouterApiKey = loadApiKey()?.trim() ?? "";

  const dataForSEOApiKey = loadDataForSEOApiKey()?.trim() ?? "";



  const [publishSitemapType, setPublishSitemapType] = useState<"post" | "entity">("post");

  const [urlHarnessSections, setUrlHarnessSections] = useState<

    Record<string, BulkHarnessSectionUi[]>

  >({});



  const siteIds = useMemo(

    () => (site?.id ? new Set([site.id]) : new Set<string>()),

    [site?.id],

  );



  const siteConfigs = useMemo(

    () =>

      site?.id

        ? { [site.id]: { sitemapType: publishSitemapType } }

        : {},

    [site?.id, publishSitemapType],

  );



  const connectedSite = useMemo(

    () =>

      site

        ? { name: site.name, siteUrl: site.siteUrl }

        : undefined,

    [site],

  );



  const bulk = useBulkAutoGenerate({

    apiKey: dataForSEOApiKey,

    openRouterApiKey,

    selectedModel: getResearchModel(),

    connectedSite,

    inputMode: "csv",

    selectedWordPressSites: siteIds,

    siteConfigs,

    scheduleFrequency: "daily",

    startDateOption: "immediate",

    startTime: "09:00",

    useCsvPublishDates: true,

    bulkPostDestination: "wordpress",

  });



  const prevRowRef = useRef(-1);

  const lastHarnessRef = useRef<BulkHarnessSectionUi[]>([]);



  useEffect(() => {

    lastHarnessRef.current = bulk.harnessSections;

  }, [bulk.harnessSections]);



  useEffect(() => {

    const prev = prevRowRef.current;

    const cur = bulk.currentRow;

    if (prev >= 0 && cur > prev) {

      const row = bulk.rows[prev];

      const urlKey = sitemapRowUrlKey(row, prev);

      const snapshot = lastHarnessRef.current;

      if (urlKey && snapshot.length > 0) {

        setUrlHarnessSections((current) => ({

          ...current,

          [urlKey]: [...snapshot],

        }));

      }

    }

    prevRowRef.current = cur;

  }, [bulk.currentRow, bulk.rows]);



  const publishedLinksByRowIndex = useMemo(() => {

    const map = new Map<number, string>();

    for (const [rowIndex, files] of bulk.filesByRow) {

      const link = publishedLinkFromRowFiles(files);

      if (link) map.set(rowIndex, link);

    }

    return map;

  }, [bulk.filesByRow]);



  const runPublish = useCallback(

    async (result: SitemapOptimizerRunResult, publishAt: string) => {

      if (!site?.id || !site.username?.trim() || !site.appPassword?.trim()) {

        throw new Error("Connect WordPress credentials in Integrations first.");

      }



      const sitemapType = resolveSitemapMergeSitemapType(site, result.entityPrimary);

      setPublishSitemapType(sitemapType);

      setUrlHarnessSections({});

      prevRowRef.current = -1;

      lastHarnessRef.current = [];



      const contracts = buildMergePublishContracts(result, publishAt);

      if (contracts.length === 0) {
        throw new Error("No content sheet merge rows to publish.");
      }



      const csvRows = contracts.map(mergeContractToCsvRow);

      const posting = buildWordPressPostingFromSelection({

        selectedSiteIds: new Set([site.id]),

        siteConfigs: { [site.id]: { sitemapType } },

        scheduleFrequency: "daily",

        customInterval: 1,

        dayOfWeek: 1,

        startDateOption: "immediate",

        customStartDate: new Date(),

        startTime: "09:00",

        totalRows: csvRows.length,

        useCsvPublishDates: true,

        postDestination: "wordpress",

      });



      if (!posting?.enabled) {

        throw new Error("WordPress posting is not configured for this site.");

      }



      await bulk.processAllRows(csvRows, posting);



      const lastIndex = csvRows.length - 1;

      if (lastIndex >= 0 && bulk.harnessSections.length > 0) {

        const row = csvRows[lastIndex];

        const urlKey = sitemapRowUrlKey(row, lastIndex);

        if (urlKey) {

          setUrlHarnessSections((current) => ({

            ...current,

            [urlKey]: [...bulk.harnessSections],

          }));

        }

      }



      return { contracts, rowCount: csvRows.length, sitemapType };

    },

    [site, bulk],

  );



  return {

    publishing: bulk.isProcessing,

    currentRow: bulk.currentRow,

    totalRows: bulk.totalRows,

    status: bulk.status,

    rows: bulk.rows,

    harnessSections: bulk.harnessSections,

    harnessPlannedSectionCount: bulk.harnessPlannedSectionCount,

    fileManager: bulk.fileManager,

    filesByRow: bulk.filesByRow,

    stats: bulk.stats,

    downloadFile: bulk.downloadFile,

    downloadRowFiles: bulk.downloadRowFiles,

    downloadAllFiles: bulk.downloadAllFiles,

    downloadRunContentCsv: bulk.downloadRunContentCsv,

    runContentCsvAvailable: bulk.runContentCsvAvailable,

    urlHarnessSections,

    publishedLinksByRowIndex,

    publishSitemapType,

    cancelPublishing: bulk.cancelProcessing,

    runPublish,

  };

}



export type { SitemapMergePublishContract };


