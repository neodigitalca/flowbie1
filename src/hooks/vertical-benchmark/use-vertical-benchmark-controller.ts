import { useCallback, useEffect, useMemo, useState } from "react";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_NO_TAGGED_CLIENTS_SELECTED_SET_BENCHMARK, NOTIFY_OPENROUTER_API_KEY_REQUIRED_FOR_BULK_CSV, NOTIFY_OPENROUTER_API_KEY_REQUIRED_FOR_GSC_EXPO, NOTIFY_UPLOAD_A_CSV_FILE_LOCAL_DOMINATOR_GRID_E, notifyBulkCsvTemplateReadyXXRowsX, notifyBulkTemplateCouldNotFinishX, notifyGridLoadedXRowsDominantKeywordX, notifyGscTop10CsvXRowsXClients, notifyGscTop10CsvXRowsXClientsXHadNo, notifyNoClientsSelectedInCategoryXAddTa } from "@/lib/notify-messages";
import { useWordPressSites } from "@/hooks/use-wordpress-sites";
import {
  revokeCsvDownloadArtifact,
  type CsvDownloadArtifact,
} from "@/lib/backlink-research/backlink-bulk-csv-export";
import { exportVerticalBenchmarkGscCsv } from "@/lib/vertical-benchmark/vertical-benchmark-api";
import { downloadGscTop10Csv } from "@/lib/vertical-benchmark/vertical-benchmark-csv-export";
import {
  revokeBenchmarkInventoryHostedLinks,
  runBenchmarkBulkTemplateDownload,
} from "@/lib/vertical-benchmark/vertical-benchmark-bulk-template";
import type {
  BenchmarkInventoryHostedLink,
  BenchmarkPipelineProgress,
} from "@/lib/vertical-benchmark/vertical-benchmark-pipeline-types";
import {
  applyCustomTagsFromSites,
  readSiteBenchmarkCustomTag,
} from "@/lib/vertical-benchmark/client-tag-from-site";
import {
  benchmarkContentKindLabel,
  resolveBenchmarkContentKinds,
  type VerticalBenchmarkContentKind,
} from "@/lib/vertical-benchmark/vertical-benchmark-types";
import {
  parseBenchmarkGridCsv,
  type BenchmarkGridCsvContext,
} from "@/lib/vertical-benchmark/vertical-benchmark-grid-entity";
import { useWordPressOptimization } from "@/contexts/wordpress-optimization-context";
import { orderBenchmarkSitesConnectedFirst, resolveBenchmarkCurateSites } from "@/lib/vertical-benchmark/vertical-benchmark-roster-order";

export type ContentTypeFilter = "" | VerticalBenchmarkContentKind;

export type ClientTagSortDir = "asc" | "desc";

export function useVerticalBenchmarkController(openRouterApiKey: string) {
  const { sites } = useWordPressSites();
  const { activeWordPressSiteId } = useWordPressOptimization();
  const [selectedSiteIds, setSelectedSiteIds] = useState<Set<string>>(() => new Set());
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentTypeFilter>("post");
  const [exporting, setExporting] = useState(false);
  const [generatingBulkTemplate, setGeneratingBulkTemplate] = useState(false);
  const [bulkTemplateProgress, setBulkTemplateProgress] = useState<BenchmarkPipelineProgress | null>(
    null,
  );
  const [bulkInventoryLinks, setBulkInventoryLinks] = useState<BenchmarkInventoryHostedLink[]>([]);
  const [gridCsvContext, setGridCsvContext] = useState<BenchmarkGridCsvContext | null>(null);
  const [gridCsvFileName, setGridCsvFileName] = useState<string | null>(null);
  const [gridCsvParsing, setGridCsvParsing] = useState(false);
  const [clientTagBySiteId, setClientTagBySiteId] = useState<Record<string, string>>({});
  const [clientTagLabelBySiteId, setClientTagLabelBySiteId] = useState<Record<string, string>>({});
  const [tagFilter, setTagFilter] = useState<string>("__all__");
  const [tagSortDir, setTagSortDir] = useState<ClientTagSortDir>("asc");
  const [exportProgress, setExportProgress] = useState<BenchmarkPipelineProgress | null>(null);
  const [gscDownloadArtifact, setGscDownloadArtifact] = useState<CsvDownloadArtifact | null>(null);
  const [bulkTemplateDownloadArtifact, setBulkTemplateDownloadArtifact] =
    useState<CsvDownloadArtifact | null>(null);

  useEffect(() => {
    return () => {
      revokeCsvDownloadArtifact(gscDownloadArtifact);
      revokeCsvDownloadArtifact(bulkTemplateDownloadArtifact);
    };
  }, [gscDownloadArtifact, bulkTemplateDownloadArtifact]);

  const sitesKey = useMemo(
    () =>
      sites
        .map((s) => `${s.id}:${readSiteBenchmarkCustomTag(s)}`)
        .sort()
        .join("|"),
    [sites],
  );

  useEffect(() => {
    const preset = applyCustomTagsFromSites(sites);
    setClientTagBySiteId(preset.tagBySiteId);
    setClientTagLabelBySiteId(preset.labelBySiteId);
  }, [sitesKey, sites]);

  const labeledSites = useMemo(
    () => sites.filter((s) => Boolean(readSiteBenchmarkCustomTag(s))),
    [sites],
  );

  const tagFilterOptions = useMemo(() => {
    const labels = new Set<string>();
    for (const site of labeledSites) {
      const label = clientTagLabelBySiteId[site.id];
      if (label) labels.add(label);
    }
    return [...labels].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [labeledSites, clientTagLabelBySiteId]);

  const rosterSites = useMemo(() => {
    let list = [...labeledSites];
    if (tagFilter !== "__all__") {
      list = list.filter((s) => clientTagLabelBySiteId[s.id] === tagFilter);
    }
    list.sort((a, b) => {
      const ta = clientTagLabelBySiteId[a.id] ?? "";
      const tb = clientTagLabelBySiteId[b.id] ?? "";
      const cmp = ta.localeCompare(tb, undefined, { sensitivity: "base" });
      if (cmp !== 0) return tagSortDir === "asc" ? cmp : -cmp;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
    return list;
  }, [labeledSites, tagFilter, clientTagLabelBySiteId, tagSortDir]);

  useEffect(() => {
    if (!rosterSites.length) {
      setSelectedSiteIds(
        activeWordPressSiteId ? new Set([activeWordPressSiteId]) : new Set(),
      );
      return;
    }
    setSelectedSiteIds(new Set(rosterSites.map((s) => s.id)));
  }, [tagFilter, sitesKey, rosterSites, activeWordPressSiteId]);

  const selectedSiteIdList = useMemo(() => [...selectedSiteIds], [selectedSiteIds]);

  const loadAllClients = useCallback(() => {
    setSelectedSiteIds(new Set(rosterSites.map((s) => s.id)));
  }, [rosterSites]);

  const selectNoClients = useCallback(() => {
    setSelectedSiteIds(new Set());
  }, []);

  const toggleSiteSelected = useCallback((siteId: string, checked: boolean) => {
    setSelectedSiteIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(siteId);
      else next.delete(siteId);
      return next;
    });
  }, []);

  const toggleTagSort = useCallback(() => {
    setTagSortDir((d) => (d === "asc" ? "desc" : "asc"));
  }, []);

  const handleExportGscCsv = useCallback(async () => {
    if (!openRouterApiKey.trim()) {
      notify.error(NOTIFY_OPENROUTER_API_KEY_REQUIRED_FOR_GSC_EXPO);
      return;
    }
    const toExport = orderBenchmarkSitesConnectedFirst(
      rosterSites.filter((s) => selectedSiteIds.has(s.id)),
      activeWordPressSiteId,
    );
    if (!toExport.length) {
      if (tagFilter !== "__all__") {
        notify.error(notifyNoClientsSelectedInCategoryXAddTa(tagFilter));
      } else {
        notify.error(NOTIFY_NO_TAGGED_CLIENTS_SELECTED_SET_BENCHMARK);
      }
      return;
    }
    const contentKinds = resolveBenchmarkContentKinds(contentTypeFilter);
    const contentLabel = benchmarkContentKindLabel(contentKinds);

    let gscSteps = toExport.map((s) => ({
      id: `gsc-${s.id}`,
      label: `GSC top 10 — ${s.name}`,
      status: "waiting" as const,
    }));

    setExporting(true);
    setExportProgress({
      phase: "gsc",
      message: "Starting GSC export…",
      percent: 0,
      busy: true,
      steps: gscSteps,
    });

    try {
      const { rows, results } = await exportVerticalBenchmarkGscCsv({
        sites: toExport,
        siteIds: toExport.map((s) => s.id),
        contentKinds,
        clientTagBySiteId,
        clientTagLabelBySiteId,
        openRouterApiKey,
        onProgress: (done, total, siteId) => {
          if (siteId) {
            gscSteps = gscSteps.map((st) =>
              st.id === `gsc-${siteId}`
                ? { ...st, status: "active" as const, detail: contentLabel }
                : st,
            );
          }
          for (let i = 0; i < done; i++) {
            const s = toExport[i];
            if (!s) continue;
            gscSteps = gscSteps.map((st) =>
              st.id === `gsc-${s.id}` ? { ...st, status: "done" as const, detail: "complete" } : st,
            );
          }
          const pct = Math.min(100, Math.round((done / Math.max(total, 1)) * 100));
          setExportProgress({
            phase: "gsc",
            message: `GSC export ${done} / ${total} clients (${contentLabel})`,
            percent: pct,
            busy: true,
            steps: [...gscSteps],
          });
        },
      });

      for (const s of toExport) {
        const result = results.find((r) => r.siteId === s.id);
        const hadRows = (result?.rowCount ?? 0) > 0;
        gscSteps = gscSteps.map((st) =>
          st.id === `gsc-${s.id}`
            ? {
                ...st,
                status: (result?.skipped && !hadRows ? "error" : "done") as "done" | "error",
                detail: result?.reason ?? (hadRows ? `${result?.rowCount ?? 0} rows` : "no data"),
              }
            : st,
        );
      }
      const okCount = results.filter((r) => (r.rowCount ?? 0) > 0).length;
      const failCount = results.length - okCount;

      if (!rows.length) {
        const hint = results.find((r) => r.reason)?.reason;
        notify.error(hint ? `No GSC rows exported (${hint})` : "No GSC rows exported for any client");
        return;
      }

      setExportProgress({
        phase: "done",
        message: `Downloading GSC CSV (${rows.length} rows)…`,
        percent: 100,
        busy: false,
        steps: gscSteps,
      });

      revokeCsvDownloadArtifact(gscDownloadArtifact);
      const artifact = downloadGscTop10Csv(rows);
      if (artifact) setGscDownloadArtifact(artifact);
      if (failCount > 0) {
        notify.success(
          `GSC top 10 CSV — ${rows.length} rows (${okCount} clients, ${failCount} had no data).`,
        );
      } else {
        notify.success(notifyGscTop10CsvXRowsXClients(rows.length, okCount));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Export failed";
      notify.error(
        msg.includes("404")
          ? "Benchmark API not found. Restart the Flowbie API server (port 3001)."
          : `Export could not finish: ${msg}`,
      );
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  }, [
    openRouterApiKey,
    rosterSites,
    selectedSiteIds,
    contentTypeFilter,
    clientTagBySiteId,
    clientTagLabelBySiteId,
    tagFilter,
    gscDownloadArtifact,
    activeWordPressSiteId,
  ]);

  const handleCreateBulkTemplate = useCallback(async () => {
    if (generatingBulkTemplate) return;
    if (!openRouterApiKey.trim()) {
      notify.error(NOTIFY_OPENROUTER_API_KEY_REQUIRED_FOR_BULK_CSV);
      return;
    }
    const { curateSites, connectedSite } = resolveBenchmarkCurateSites({
      allSites: sites,
      rosterSites,
      selectedSiteIds,
      connectedSiteId: activeWordPressSiteId,
    });
    if (!curateSites.length) {
      if (tagFilter !== "__all__") {
        notify.error(notifyNoClientsSelectedInCategoryXAddTa(tagFilter));
      } else {
        notify.error(NOTIFY_NO_TAGGED_CLIENTS_SELECTED_SET_BENCHMARK);
      }
      return;
    }

    setGeneratingBulkTemplate(true);
    revokeBenchmarkInventoryHostedLinks(bulkInventoryLinks);
    setBulkInventoryLinks([]);
    setBulkTemplateProgress({
      phase: "start",
      message: "Starting…",
      percent: 0,
      busy: true,
      indeterminate: true,
      steps: [],
    });
    const contentKinds = resolveBenchmarkContentKinds(contentTypeFilter);
    try {
      revokeCsvDownloadArtifact(bulkTemplateDownloadArtifact);
      const result = await runBenchmarkBulkTemplateDownload({
        sites: curateSites,
        connectedSite,
        contentKinds,
        gridContext: gridCsvContext,
        openRouterApiKey,
        clientTagBySiteId,
        clientTagLabelBySiteId,
        onProgress: (p) => {
          setBulkTemplateProgress(p);
          if (p.inventoryLinks?.length) {
            setBulkInventoryLinks(p.inventoryLinks);
          }
        },
      });
      if (result) {
        setBulkTemplateDownloadArtifact(result.artifact);
        if (result.inventoryLinks.length) {
          setBulkInventoryLinks(result.inventoryLinks);
        }
        const invTotal = Object.values(result.inventoryTitlesByClient).reduce((a, n) => a + n, 0);
        const invNote =
          invTotal > 0 ?
            ` Inventory sent to AI: ${invTotal} published title(s).`
          : "";
        notify.success(
          `Bulk CSV template ready (${benchmarkContentKindLabel(contentKinds)}) — ${result.artifact.rowCount} rows.${invNote}`,
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bulk template failed";
      notify.error(notifyBulkTemplateCouldNotFinishX(msg));
    } finally {
      setGeneratingBulkTemplate(false);
      setBulkTemplateProgress(null);
    }
  }, [
    openRouterApiKey,
    sites,
    rosterSites,
    selectedSiteIds,
    contentTypeFilter,
    clientTagBySiteId,
    clientTagLabelBySiteId,
    tagFilter,
    bulkTemplateDownloadArtifact,
    generatingBulkTemplate,
    gridCsvContext,
    activeWordPressSiteId,
    bulkInventoryLinks,
  ]);

  const handleGridCsvFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      if (!file.name.toLowerCase().endsWith(".csv")) {
        notify.error(NOTIFY_UPLOAD_A_CSV_FILE_LOCAL_DOMINATOR_GRID_E);
        return;
      }
      setGridCsvParsing(true);
      try {
        const text = await file.text();
        const result = await parseBenchmarkGridCsv(text, file.size);
        if (!result.ok) {
          notify.error(result.error);
          return;
        }
        setGridCsvContext(result);
        setGridCsvFileName(file.name);
        notify.success(
          `Grid loaded — ${result.matchedRowCount} rows, dominant keyword “${result.dominantKeyword}”.`,
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Grid CSV could not be read";
        notify.error(msg);
      } finally {
        setGridCsvParsing(false);
      }
    },
    [openRouterApiKey],
  );

  const clearGridCsv = useCallback(() => {
    setGridCsvContext(null);
    setGridCsvFileName(null);
  }, []);

  const busy = exporting || generatingBulkTemplate;

  return {
    labeledCount: labeledSites.length,
    rosterSites,
    selectedSiteIds,
    selectedSiteIdList,
    contentTypeFilter,
    setContentTypeFilter,
    loadAllClients,
    selectNoClients,
    toggleSiteSelected,
    exporting,
    generatingBulkTemplate,
    bulkTemplateProgress,
    bulkInventoryLinks,
    busy,
    clientTagLabelBySiteId,
    tagFilter,
    setTagFilter,
    tagFilterOptions,
    tagSortDir,
    toggleTagSort,
    exportProgress,
    gscDownloadArtifact,
    bulkTemplateDownloadArtifact,
    handleExportGscCsv,
    handleCreateBulkTemplate,
    gridCsvContext,
    gridCsvFileName,
    gridCsvParsing,
    handleGridCsvFile,
    clearGridCsv,
  };
}
