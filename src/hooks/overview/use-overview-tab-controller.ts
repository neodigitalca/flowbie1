import type { OverviewTabContentProps } from "@/components/overview/overview-tab/overview-tab-content-types";
import { useOverviewTabBlogHeaders } from "@/hooks/overview/use-overview-tab-blog-headers";
import { useOverviewTabContentCleanup } from "@/hooks/overview/use-overview-tab-content-cleanup";
import { useOverviewTabBlogLinks } from "@/hooks/overview/use-overview-tab-blog-links";
import { useOverviewTabBlogWikipediaLink } from "@/hooks/overview/use-overview-tab-blog-wikipedia-link";
import { useOverviewTabBlogOverview } from "@/hooks/overview/use-overview-tab-blog-overview";
import { useOverviewTabBlogInContentImage } from "@/hooks/overview/use-overview-tab-blog-in-content-image";
import { useOverviewTabBase } from "@/hooks/overview/use-overview-tab-base";
import { useOverviewTabSitemapLoad } from "@/hooks/overview/use-overview-tab-sitemap-load";
import { useOverviewTabScrapeWp } from "@/hooks/overview/use-overview-tab-scrape-wp";
import { useOverviewTabAiTitleMetaUrlCsv } from "@/hooks/overview/use-overview-tab-ai-title-meta-url-csv";
import { useOverviewTabKeywordsDates } from "@/hooks/overview/use-overview-tab-keywords-dates";
import { useOverviewTabFaqHandlers } from "@/hooks/overview/use-overview-tab-faq-handlers";
import { useOverviewTabDfsResearch } from "@/hooks/overview/use-overview-tab-dfs-research";
import { useOverviewTabResearchPipelines } from "@/hooks/overview/use-overview-tab-research-pipelines";
import { useOverviewTabBulkSeoWp } from "@/hooks/overview/use-overview-tab-bulk-seo-wp";

export function useOverviewTabController(props: OverviewTabContentProps) {
  const base = useOverviewTabBase(props);
  const { site } = props;

  const sitemapLoad = useOverviewTabSitemapLoad({
    rowsRef: base.rowsRef,
    setRows: base.setRows,
    sitemapSource: base.sitemapSource,
    site,
    resolveBindings: base.resolveBindings,
    prefetchOverviewInventory: base.prefetchOverviewInventory,
    getInventoryMatchForUrl: base.getInventoryMatchForUrl,
  });

  const scrapeWp = useOverviewTabScrapeWp({
    site,
    sitemapSource: base.sitemapSource,
    rows: base.visibleRows,
    setRows: base.setRows,
    bindings: base.bindings,
    resolveBindings: base.resolveBindings,
    downloadRow: base.downloadRow,
    scrapeMetaForUrl: base.scrapeMetaForUrl,
    updateRow: base.updateRow,
    getInventoryRow: base.getInventoryRow,
    getInventoryMatchForUrl: base.getInventoryMatchForUrl,
    setBulkActionProgress: base.setBulkActionProgress,
    remapBindingUrl: base.remapBindingUrl,
    mergeInventoryContentForSource: base.mergeInventoryContentForSource,
    bulkScopeUrlKeys: base.bulkScopeUrlKeys,
  });

  const faq = useOverviewTabFaqHandlers({
    site,
    rows: base.visibleRows,
    optimizeFaq: base.optimizeFaq,
    optimizeFaqQuestion: base.optimizeFaqQuestion,
    optimizeFaqAnswer: base.optimizeFaqAnswer,
    updateRow: base.updateRow,
    getDfsSerpContext: base.getDfsSerpContext,
    bulkAiFaqSeedCount: base.bulkAiFaqSeedCount,
    opt: base.opt,
    bulkScopeUrlKeys: base.bulkScopeUrlKeys,
  });

  const aiCsv = useOverviewTabAiTitleMetaUrlCsv({
    site,
    sitemapSource: base.sitemapSource,
    rows: base.visibleRows,
    bindings: base.bindings,
    resolveBindings: base.resolveBindings,
    prefetchOverviewInventory: base.prefetchOverviewInventory,
    optimizeTitle: base.optimizeTitle,
    optimizeMeta: base.optimizeMeta,
    updateRow: base.updateRow,
    setBulkActionProgress: base.setBulkActionProgress,
    setOverviewMetaCsvExportBusy: base.setOverviewMetaCsvExportBusy,
    resolvePostBodyHtmlForSentiment: base.resolvePostBodyHtmlForSentiment,
    gscQuickWinsFile: base.gscQuickWinsFile,
    bulkScopeUrlKeys: base.bulkScopeUrlKeys,
  });

  const kwDates = useOverviewTabKeywordsDates({
    site,
    sitemapSource: base.sitemapSource,
    rows: base.visibleRows,
    setRows: base.setRows,
    bindings: base.bindings,
    resolveBindings: base.resolveBindings,
    resolvePostBodyHtmlForSentiment: base.resolvePostBodyHtmlForSentiment,
    deriveEntityKeyword: base.deriveEntityKeyword,
    deriveFocusKeywordFromPageContext: base.deriveFocusKeywordFromPageContext,
    deriveFocusKeywordsFromPageContextBatch: base.deriveFocusKeywordsFromPageContextBatch,
    deriveEntityKeywordsBatch: base.deriveEntityKeywordsBatch,
    updateRow: base.updateRow,
    setBulkActionProgress: base.setBulkActionProgress,
    bulkScopeUrlKeys: base.bulkScopeUrlKeys,
  });

  const dfs = useOverviewTabDfsResearch({
    rows: base.visibleRows,
    updateRow: base.updateRow,
    site,
    gscQuickWinsFile: base.gscQuickWinsFile,
    serpDumpUrl: base.serpDumpUrl,
    portfolioBlockedHostsForSemrush: base.portfolioBlockedHostsForSemrush,
    sitemapSource: base.sitemapSource,
    deriveEntityKeyword: base.deriveEntityKeyword,
    deriveFocusKeywordFromPageContext: base.deriveFocusKeywordFromPageContext,
    bindings: base.bindings,
    resolveBindings: base.resolveBindings,
    resolvePostBodyHtmlForSentiment: base.resolvePostBodyHtmlForSentiment,
  });

  const pipelines = useOverviewTabResearchPipelines({
    rows: base.visibleRows,
    rowsRef: base.visibleRowsRef,
    updateRow: base.updateRow,
    setBulkActionProgress: base.setBulkActionProgress,
    setGscQuickWinsFile: base.setGscQuickWinsFile,
    gscQuickWinsFile: base.gscQuickWinsFile,
    serpDumpUrl: base.serpDumpUrl,
    portfolioBlockedHostsForSemrush: base.portfolioBlockedHostsForSemrush,
    site,
    opt: base.opt,
    bulkSeoExtraOptions: base.bulkSeoExtraOptions,
    bindings: base.bindings,
    getInventoryMatchForUrl: base.getInventoryMatchForUrl,
    prefetchOverviewInventory: base.prefetchOverviewInventory,
    runAiAllMetaBatchForCatalog: base.runAiAllMetaBatchForCatalog,
    bulkAiFaqSeedCount: base.bulkAiFaqSeedCount,
    sitemapSource: base.sitemapSource,
    optimizeFaq: base.optimizeFaq,
    optimizeFaqQuestion: base.optimizeFaqQuestion,
    optimizeFaqAnswer: base.optimizeFaqAnswer,
    getDfsSerpContext: base.getDfsSerpContext,
    handleDataForSeoResearch: dfs.handleDataForSeoResearch,
    ensureOverviewKeywordsForMissingRows: kwDates.ensureOverviewKeywordsForMissingRows,
    handleAiTitleRow: aiCsv.handleAiTitleRow,
    handleAiMetaRow: aiCsv.handleAiMetaRow,
    handleAiFaqRowAll: faq.handleAiFaqRowAll,
    bulkScopeUrlKeys: base.bulkScopeUrlKeys,
    bulkScopeUrlKeysRef: base.bulkScopeUrlKeysRef,
  });

  const bulkSeoWp = useOverviewTabBulkSeoWp({
    site,
    sitemapSource: base.sitemapSource,
    rows: base.visibleRows,
    bindings: base.bindings,
    resolveBindings: base.resolveBindings,
    prefetchOverviewInventory: base.prefetchOverviewInventory,
    setBulkSeoCsvExportBusy: base.setBulkSeoCsvExportBusy,
    opt: base.opt,
    bulkScopeUrlKeys: base.bulkScopeUrlKeys,
    setBulkActionProgress: base.setBulkActionProgress,
    getInventoryMatchForUrl: base.getInventoryMatchForUrl,
  });

  const blogHeaders = useOverviewTabBlogHeaders({
    site,
    sitemapSource: base.sitemapSource,
    rows: base.visibleRows,
    bindings: base.bindings,
    resolveBindings: base.resolveBindings,
    updateRow: base.updateRow,
    opt: base.opt,
    apiKey: props.apiKey,
    selectedModel: props.selectedModel,
    bulkScopeUrlKeys: base.bulkScopeUrlKeys,
    getInventoryMatchForUrl: base.getInventoryMatchForUrl,
    mergeInventoryContentForSource: base.mergeInventoryContentForSource,
  });

  const contentCleanup = useOverviewTabContentCleanup({
    site,
    sitemapSource: base.sitemapSource,
    rows: base.visibleRows,
    bindings: base.bindings,
    resolveBindings: base.resolveBindings,
    updateRow: base.updateRow,
    opt: base.opt,
    bulkScopeUrlKeys: base.bulkScopeUrlKeys,
    getInventoryMatchForUrl: base.getInventoryMatchForUrl,
    mergeInventoryContentForSource: base.mergeInventoryContentForSource,
  });

  const blogLinks = useOverviewTabBlogLinks({
    site,
    sitemapSource: base.sitemapSource,
    rows: base.visibleRows,
    bindings: base.bindings,
    resolveBindings: base.resolveBindings,
    updateRow: base.updateRow,
    opt: base.opt,
    apiKey: props.apiKey,
    selectedModel: props.selectedModel,
    bulkScopeUrlKeys: base.bulkScopeUrlKeys,
    getInventoryMatchForUrl: base.getInventoryMatchForUrl,
  });

  const blogWikipediaLink = useOverviewTabBlogWikipediaLink({
    site,
    sitemapSource: base.sitemapSource,
    rows: base.visibleRows,
    bindings: base.bindings,
    resolveBindings: base.resolveBindings,
    updateRow: base.updateRow,
    opt: base.opt,
    bulkScopeUrlKeys: base.bulkScopeUrlKeys,
    apiKey: props.apiKey,
    getInventoryMatchForUrl: base.getInventoryMatchForUrl,
    prefetchOverviewInventory: base.prefetchOverviewInventory,
    mergeInventoryContentForSource: base.mergeInventoryContentForSource,
  });

  const blogOverview = useOverviewTabBlogOverview({
    site,
    sitemapSource: base.sitemapSource,
    rows: base.visibleRows,
    bindings: base.bindings,
    resolveBindings: base.resolveBindings,
    updateRow: base.updateRow,
    opt: base.opt,
    apiKey: props.apiKey,
    selectedModel: props.selectedModel,
    bulkScopeUrlKeys: base.bulkScopeUrlKeys,
    getInventoryMatchForUrl: base.getInventoryMatchForUrl,
    prefetchOverviewInventory: base.prefetchOverviewInventory,
  });

  const blogInContentImage = useOverviewTabBlogInContentImage({
    site,
    sitemapSource: base.sitemapSource,
    rows: base.visibleRows,
    bindings: base.bindings,
    resolveBindings: base.resolveBindings,
    updateRow: base.updateRow,
    opt: base.opt,
    apiKey: props.apiKey,
    selectedModel: props.selectedModel,
    bulkScopeUrlKeys: base.bulkScopeUrlKeys,
    getInventoryMatchForUrl: base.getInventoryMatchForUrl,
    prefetchOverviewInventory: base.prefetchOverviewInventory,
  });

  return {
    site: props.site,
    ...base,
    overviewSitemapLoadBusy: sitemapLoad.overviewSitemapLoadBusy,
    handleLoadSitemap: sitemapLoad.handleLoadSitemap,
    handleRefreshSitemap: () =>
      sitemapLoad.handleLoadSitemap({ force: true, silent: false, applyToUi: true }),
    ...scrapeWp,
    ...aiCsv,
    ...kwDates,
    ...faq,
    ...dfs,
    ...pipelines,
    ...bulkSeoWp,
    ...blogHeaders,
    ...contentCleanup,
    ...blogLinks,
    ...blogWikipediaLink,
    ...blogOverview,
    ...blogInContentImage,
  };
}

export type OverviewTabController = ReturnType<typeof useOverviewTabController>;
