import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Components } from "react-markdown";
import { FileText } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWordPressSites } from "@/hooks/use-wordpress-sites";
import { useWordPressOptimization } from "@/contexts/wordpress-optimization-context";
import { loadApiKey } from "@/lib/api";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_ADD_AN_OPENROUTER_API_KEY_IN_SETTINGS, NOTIFY_COULD_NOT_COPY, NOTIFY_DOWNLOADED_MARKDOWN_FILE, NOTIFY_DOWNLOADED_OUTLINE_JSON, NOTIFY_DOWNLOADED_OUTLINE_POST_BODY, NOTIFY_GENERATE_A_REPORT_FIRST, NOTIFY_GSC_REPORT_GENERATED, NOTIFY_MARKDOWN_COPIED, NOTIFY_REPORT_ADDED_TO_KNOWLEDGE_BASE, NOTIFY_REPORT_CANCELLED, NOTIFY_SET_A_PUBLIC_SITE_URL_FOR_THIS_PROPERTY_ } from "@/lib/notify-messages";
import { runGscReportingAgentHarness } from "@/lib/gsc-reporting/gsc-reporting-agent-harness";
import { getPublicSiteUrl } from "@/lib/wordpress-site-public-url";
import type {
  GscReportingOutlineResult,
  GscReportingPipelineProgress,
  GscReportingSectionResult,
} from "@/lib/gsc-reporting/gsc-reporting-types";
import { KB_FILES_STORAGE_KEY, type StoredFile } from "@/components/integrations/types";
import { cn } from "@/lib/utils";
import { pickClusterMarkdownForPipeline } from "@/lib/gsc-reporting/gsc-query-cluster-ai";
import type { GscFetchDateRange } from "@/lib/gsc-reporting/gsc-console-ui-url";
import {
  computeCompareRangesForPreset,
  formatLocalYmd,
  validateGscCompareFetchRanges,
  type GscCompareRanges,
  type GscReportingComparePresetId,
} from "@/lib/gsc-reporting/gsc-fetch-date-presets";
import { getPublicSiteUrl } from "@/lib/wordpress-site-public-url";
import { GscReportingSectionsPanel } from "@/components/research/reporting/GscReportingSectionsPanel";
import { GscReportingWorkspaceHeader } from "@/components/research/reporting/GscReportingWorkspaceHeader";
import { gscReportingDetailsCanOpen } from "@/components/research/reporting/GscReportingDetailsPanel";
import type { GeneratorWorkspaceChromeBindings } from "@/components/blog-generator/generator-workspace-chrome-bindings";
import { WORKSPACE_DETAILS_DIM_OVERLAY_CLASS } from "@/components/overview/overview-tab/overview-tab-content-constants";
import {
  SEO_WORKSPACE_BODY_SCROLL_CLASS,
  SEO_WORKSPACE_HEADER_CLASS,
  SEO_WORKSPACE_SHELL_CLASS,
} from "@/components/seo/seo-workspace-layout";

const isChildrenArray = (children: unknown): children is unknown[] =>
  Array.isArray(children) && children.every((c) => typeof c === "object" && c !== null);

/** Stitched GSC report tables: wide MoM grids must scroll horizontally, not squeeze columns. */
const reportMarkdownComponents: Components = {
  table: ({ children, ...props }) => (
    <div className="my-3 max-w-full overflow-x-auto rounded-md border border-border/50 bg-black/30 shadow-sm">
      <Table
        className={cn(
          "!w-max min-w-full border-collapse text-sm leading-snug",
          "[&_th]:h-auto [&_th]:min-h-0 [&_th]:bg-muted/60 [&_th]:px-2.5 [&_th]:py-2 [&_th]:text-base [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-white/95",
          "[&_th:first-child]:min-w-[min(18rem,45vw)] [&_th:first-child]:max-w-[min(28rem,60vw)] [&_th:first-child]:whitespace-normal [&_th:first-child]:text-left",
          "[&_th:not(:first-child)]:whitespace-nowrap [&_th:not(:first-child)]:text-right",
          "[&_td]:px-2.5 [&_td]:py-2 [&_td]:text-white/90",
          "[&_td:first-child]:min-w-[min(18rem,45vw)] [&_td:first-child]:max-w-[min(28rem,60vw)] [&_td:first-child]:break-words [&_td:first-child]:align-top [&_td:first-child]:text-left [&_td:first-child]:leading-snug",
          "[&_td:not(:first-child)]:whitespace-nowrap [&_td:not(:first-child)]:tabular-nums [&_td:not(:first-child)]:text-right",
        )}
        {...props}
      >
        {children}
      </Table>
    </div>
  ),
  thead: ({ children, ...props }) => <TableHeader {...props}>{children}</TableHeader>,
  tbody: ({ children, ...props }) => <TableBody {...props}>{children}</TableBody>,
  tr: ({ children, ...props }) => <TableRow {...props}>{children}</TableRow>,
  th: ({ children, ...props }) => (
    <TableHead {...props}>{isChildrenArray(children) ? children[0] : children}</TableHead>
  ),
  td: ({ children, ...props }) => (
    <TableCell {...props}>{isChildrenArray(children) ? children[0] : children}</TableCell>
  ),
};

function triggerBlobDownload(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type ReportingTabProps = GeneratorWorkspaceChromeBindings;

export function ReportingTab({ activeSection, onSectionChange }: ReportingTabProps) {
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const { sites } = useWordPressSites();
  const { activeWordPressSiteId, setActiveWordPressSiteId } = useWordPressOptimization();
  const enabledSites = useMemo(() => sites.filter((s) => s.enabled !== false), [sites]);

  useEffect(() => {
    if (enabledSites.length === 0) return;
    if (!activeWordPressSiteId || !enabledSites.some((s) => s.id === activeWordPressSiteId)) {
      setActiveWordPressSiteId(enabledSites[0]!.id);
    }
  }, [enabledSites, activeWordPressSiteId, setActiveWordPressSiteId]);

  const site = useMemo(() => {
    if (enabledSites.length === 0) return null;
    if (activeWordPressSiteId) {
      const m = enabledSites.find((s) => s.id === activeWordPressSiteId);
      if (m) return m;
    }
    return enabledSites[0]!;
  }, [enabledSites, activeWordPressSiteId]);

  const reportingPublicSiteUrl = useMemo(
    () => (site ? getPublicSiteUrl(site).trim() : ""),
    [site],
  );

  const [files, setFiles] = useState<{ name: string; content: string }[]>([]);
  const [reportMd, setReportMd] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<GscReportingPipelineProgress | null>(null);
  const [gscFetchRange, setGscFetchRange] = useState<GscFetchDateRange | null>(null);
  const [gscCompareFetchRange, setGscCompareFetchRange] = useState<GscFetchDateRange | null>(null);
  const [gscFetchPreset, setGscFetchPreset] = useState<GscReportingComparePresetId>("mom");
  const [compareRangeDraft, setCompareRangeDraft] = useState<GscCompareRanges>(() =>
    computeCompareRangesForPreset("mom"),
  );
  const todayYmdMax = useMemo(() => formatLocalYmd(new Date()), []);
  const [lastOutline, setLastOutline] = useState<GscReportingOutlineResult | null>(null);
  const [outlinePostJson, setOutlinePostJson] = useState<string | null>(null);
  const [sectionMap, setSectionMap] = useState<Record<number, GscReportingSectionResult>>({});
  const [generatingSectionIndex, setGeneratingSectionIndex] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (gscFetchPreset === "custom_compare") return;
    setCompareRangeDraft(computeCompareRangesForPreset(gscFetchPreset));
  }, [gscFetchPreset]);

  const filesForPipeline = useMemo(() => {
    const base = files.map((f) => ({ ...f }));
    const md = pickClusterMarkdownForPipeline(files, {});
    if (md) base.push({ name: "Queries-AI-clusters.md", content: md });
    return base;
  }, [files]);

  const onProgress = useCallback((p: GscReportingPipelineProgress) => {
    setProgress(p);
  }, []);

  const resetReportArtifacts = useCallback(() => {
    setReportMd(null);
    setLastOutline(null);
    setOutlinePostJson(null);
    setSectionMap({});
    setGeneratingSectionIndex(null);
  }, []);

  const handleRun = useCallback(async () => {
    if (!site) return;
    const apiKey = loadApiKey()?.trim();
    if (!apiKey) {
      notify.error(NOTIFY_ADD_AN_OPENROUTER_API_KEY_IN_SETTINGS);
      return;
    }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setBusy(true);
    setProgress({ step: 0, total: 1, label: "Starting…" });
    resetReportArtifacts();
    try {
      const comparePreset =
        gscFetchPreset === "yoy" ? "yoy" : gscFetchPreset === "mom" ? "mom" : undefined;
      const useCached = files.length > 0;
      if (!useCached && !reportingPublicSiteUrl.trim()) {
        notify.error(NOTIFY_SET_A_PUBLIC_SITE_URL_FOR_THIS_PROPERTY_);
        return;
      }
      if (!useCached) {
        const check = validateGscCompareFetchRanges(compareRangeDraft.primary, compareRangeDraft.compare);
        if (!check.ok) {
          notify.error(check.error);
          return;
        }
      }

      const result = await runGscReportingAgentHarness({
        site,
        comparePreset: comparePreset ?? "mom",
        compareRanges: gscFetchPreset === "custom_compare" ? compareRangeDraft : undefined,
        cachedFiles: useCached ? filesForPipeline : undefined,
        signal: abortRef.current.signal,
        onProgress,
        onOutlineReady: ({ outline, outlineRequestBodyJson }) => {
          setLastOutline(outline);
          setOutlinePostJson(outlineRequestBodyJson);
        },
        onSectionStart: (index) => {
          setGeneratingSectionIndex(index);
        },
        onSectionReady: (row) => {
          setSectionMap((m) => ({ ...m, [row.index]: row }));
        },
      });

      if (!useCached) {
        setFiles(result.files);
        setGscFetchRange(result.fetchRange);
        setGscCompareFetchRange(result.compareFetchRange);
      }

      setReportMd(result.markdown);
      setLastOutline(result.outline);
      setOutlinePostJson(result.outlineRequestBodyJson);
      setSectionMap(Object.fromEntries(result.sectionResults.map((r) => [r.index, r])));
      notify.success(NOTIFY_GSC_REPORT_GENERATED);
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        notify.info(NOTIFY_REPORT_CANCELLED);
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        notify.error(msg);
      }
    } finally {
      setBusy(false);
      setProgress(null);
      setGeneratingSectionIndex(null);
      abortRef.current = null;
    }
  }, [
    site,
    files.length,
    filesForPipeline,
    reportingPublicSiteUrl,
    compareRangeDraft,
    gscFetchPreset,
    onProgress,
    resetReportArtifacts,
  ]);

  const copyMarkdown = useCallback(async () => {
    if (!reportMd?.trim()) {
      notify.error(NOTIFY_GENERATE_A_REPORT_FIRST);
      return;
    }
    try {
      await navigator.clipboard.writeText(reportMd.trim());
      notify.success(NOTIFY_MARKDOWN_COPIED);
    } catch {
      notify.error(NOTIFY_COULD_NOT_COPY);
    }
  }, [reportMd]);

  const downloadMarkdown = useCallback(() => {
    if (!reportMd?.trim()) {
      notify.error(NOTIFY_GENERATE_A_REPORT_FIRST);
      return;
    }
    const slug = (site?.name || "gsc-report").replace(/\s+/g, "-");
    triggerBlobDownload(reportMd.trim(), `gsc-report-${slug}-${Date.now()}.md`, "text/markdown;charset=utf-8");
    notify.success(NOTIFY_DOWNLOADED_MARKDOWN_FILE);
  }, [reportMd, site?.name]);

  const handleExportKb = useCallback(() => {
    if (!reportMd?.trim() || !site) return;
    const ts = Date.now();
    const safe = site.name.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
    const newFile: StoredFile = {
      name: `gsc-report-${safe}-${ts}.md`,
      size: reportMd.length,
      content: reportMd,
      starred: false,
      timestamp: ts,
    };
    const stored = localStorage.getItem(KB_FILES_STORAGE_KEY) || "[]";
    const existing = JSON.parse(stored) as StoredFile[];
    const all = [...existing, newFile];
    localStorage.setItem(KB_FILES_STORAGE_KEY, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent("kb-files-updated", { detail: { files: all } }));
    notify.success(NOTIFY_REPORT_ADDED_TO_KNOWLEDGE_BASE);
  }, [reportMd, site]);

  const downloadOutlineJson = useCallback(() => {
    if (!lastOutline) return;
    const slug = (site?.name || "gsc").replace(/\s+/g, "-");
    triggerBlobDownload(JSON.stringify(lastOutline, null, 2), `gsc-outline-${slug}-${Date.now()}.json`, "application/json;charset=utf-8");
    notify.success(NOTIFY_DOWNLOADED_OUTLINE_JSON);
  }, [lastOutline, site?.name]);

  const downloadOutlinePostJson = useCallback(() => {
    if (!outlinePostJson) return;
    triggerBlobDownload(outlinePostJson, `gsc-outline-openrouter-post-${Date.now()}.json`, "application/json;charset=utf-8");
    notify.success(NOTIFY_DOWNLOADED_OUTLINE_POST_BODY);
  }, [outlinePostJson]);

  const downloadSectionMd = useCallback((row: GscReportingSectionResult) => {
    const slug = (site?.name || "gsc").replace(/\s+/g, "-");
    triggerBlobDownload(
      row.markdownBlock,
      `gsc-section-${row.plan.id}-${slug}-${Date.now()}.md`,
      "text/markdown;charset=utf-8",
    );
  }, [site?.name]);

  const downloadSectionPostJson = useCallback((row: GscReportingSectionResult) => {
    triggerBlobDownload(row.requestBodyJson, `gsc-section-openrouter-${row.plan.id}-${Date.now()}.json`, "application/json;charset=utf-8");
  }, []);

  const outlineSections = lastOutline?.sections;

  const handleGscFetchPresetChange = useCallback((preset: GscReportingComparePresetId) => {
    setGscFetchPreset(preset);
  }, []);

  const canOpenDetails = useMemo(
    () =>
      gscReportingDetailsCanOpen(
        Boolean(site),
        busy,
        Boolean(reportMd?.trim()) || Boolean(lastOutline),
        files.length,
      ),
    [site, busy, reportMd, lastOutline, files.length],
  );

  if (enabledSites.length === 0) {
    return (
      <div className="local-analysis-panel space-y-2 px-0 py-1 sm:px-1">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          <h2 className="min-h-[1rem] text-base font-semibold leading-normal tracking-tight text-foreground">
            GSC Reporting
          </h2>
        </div>
        <div className="neo-pulse-zone-tile--data px-2 py-3 text-[1rem] leading-normal text-muted-foreground">
          Connect a WordPress site and select it in the header to run reporting.
        </div>
      </div>
    );
  }

  return (
    <div className={SEO_WORKSPACE_SHELL_CLASS}>
      {!site ? (
        <div className="neo-pulse-zone-tile--data px-2 py-3 text-base leading-normal text-muted-foreground">
          Select a site in the header.
        </div>
      ) : !site.siteUrl?.trim() ? (
        <div className="neo-pulse-zone-tile--data px-2 py-3 text-base leading-normal text-muted-foreground">
          This site has no URL saved.
        </div>
      ) : (
        <>
          <div className={SEO_WORKSPACE_HEADER_CLASS}>
            <GscReportingWorkspaceHeader
              activeSection={activeSection}
              onSectionChange={onSectionChange}
              onDetailsOpenChange={setDetailsDrawerOpen}
              busy={busy}
              progress={progress}
              canOpenDetails={canOpenDetails}
              outlineSections={outlineSections}
              sectionMap={sectionMap}
              generatingSectionIndex={generatingSectionIndex}
              toolbarProps={{
                busy,
                gscFetchPreset,
                onGscFetchPresetChange: handleGscFetchPresetChange,
                compareRangeDraft,
                onCompareRangeDraftChange: setCompareRangeDraft,
                todayYmdMax,
                hasReport: Boolean(reportMd?.trim()),
                onGenerate: () => void handleRun(),
                onCancel: () => abortRef.current?.abort(),
                onCopyMarkdown: () => void copyMarkdown(),
                onDownloadMarkdown: downloadMarkdown,
                onExportKb: handleExportKb,
              }}
              detailsProps={{
                busy,
                progress,
                siteName: site.name,
                siteUrl: reportingPublicSiteUrl || null,
                gscFetchPreset,
                gscFetchRange,
                gscCompareFetchRange,
                cachedFileCount: files.length,
                sectionCount: outlineSections?.length ?? 0,
              }}
            />
          </div>

          <div className={cn(SEO_WORKSPACE_BODY_SCROLL_CLASS, "relative")}>
            {detailsDrawerOpen ? (
              <div className={WORKSPACE_DETAILS_DIM_OVERLAY_CLASS} aria-hidden />
            ) : null}
          {outlineSections && outlineSections.length > 0 ? (
            <GscReportingSectionsPanel
              plans={outlineSections}
              sectionMap={sectionMap}
              busy={busy}
              generatingSectionIndex={generatingSectionIndex}
              outlineDownloadDisabled={!lastOutline}
              outlinePostDisabled={!outlinePostJson}
              onDownloadOutlineJson={downloadOutlineJson}
              onDownloadOutlinePostJson={downloadOutlinePostJson}
              onDownloadSectionMd={downloadSectionMd}
              onDownloadSectionPostJson={downloadSectionPostJson}
            />
          ) : null}

          {reportMd?.trim() ? (
            <div className="neo-pulse-zone-tile--analysis space-y-2 px-2 py-2 sm:px-3">
              <div className="min-h-[1rem] text-base font-semibold uppercase leading-normal tracking-wide text-muted-foreground">
                Stitched report preview
              </div>
              <div className="h-[min(50vh,28rem)] min-h-0 min-w-0 overflow-y-auto overflow-x-auto rounded-md border border-border/50 bg-black/20">
                <div className="prose prose-base prose-invert max-w-none p-3 text-base leading-relaxed text-white/90 [&_table]:!w-max [&_table]:max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={reportMarkdownComponents}>
                    {reportMd}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ) : null}
          </div>
        </>
      )}
    </div>
  );
}
