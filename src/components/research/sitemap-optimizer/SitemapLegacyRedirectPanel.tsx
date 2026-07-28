import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLegacyRedirectMatchRun } from "@/hooks/research/use-legacy-redirect-match-run";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_CONNECT_WORDPRESS_CREDENTIALS_IN_INTEGRA, NOTIFY_NO_URLS_FOUND_IN_THE_UPLOADED_SHEET, NOTIFY_SELECT_SITE_URL, NOTIFY_UPLOADED_FILE_IS_EMPTY, NOTIFY_UPLOAD_A_LEGACY_URL_SHEET_FIRST } from "@/lib/notify-messages";
import {
  buildLegacyRedirectGridRowsFromSheetLines,
  legacyRedirectGridPageCount,
  mergeLegacyRedirectMatchesIntoGrid,
} from "@/lib/sitemap-optimizer/legacy-redirect-grid-rows";
import {
  buildLegacyRedirectRankMathCsv,
  legacyRedirectExportFilename,
} from "@/lib/sitemap-optimizer/legacy-redirect-export-csv";
import {
  buildLegacyRedirectMicroSnapshot,
  legacyRedirectHeaderProgressFromMatch,
} from "@/lib/sitemap-optimizer/legacy-redirect-header-progress";
import { revokePressReleaseInventoryHostedLink } from "@/lib/press-release/press-release-site-inventory";
import { SitemapLegacyRedirectGrid } from "@/components/research/sitemap-optimizer/SitemapLegacyRedirectGrid";
import type { SitemapLegacyRedirectWorkspaceBindings } from "@/components/research/sitemap-optimizer/sitemap-legacy-redirect-workspace-bindings";
import type { LegacyRedirectGridRow, LegacyRedirectMatchRow } from "@/lib/sitemap-optimizer/types";
import type { WordPressSite } from "@/components/integrations/types";

export type SitemapLegacyRedirectPanelProps = {
  site: WordPressSite | null;
  workspaceMode: string;
  siteReady: boolean;
  legacyRedirectWorkspace?: boolean;
  onLegacyRedirectWorkspaceBindings?: (bindings: SitemapLegacyRedirectWorkspaceBindings) => void;
};

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SitemapLegacyRedirectPanel({
  site,
  workspaceMode,
  siteReady,
  legacyRedirectWorkspace = false,
  onLegacyRedirectWorkspaceBindings,
}: SitemapLegacyRedirectPanelProps) {
  const { progress, batchProgress, result, hostedLink, error, running, run, cancel } =
    useLegacyRedirectMatchRun();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gridBaseRef = useRef<LegacyRedirectGridRow[]>([]);
  const lastDownloadKeyRef = useRef<string | null>(null);
  const hostedHrefRef = useRef<string | null>(null);
  const [legacySheetText, setLegacySheetText] = useState("");
  const [legacySheetName, setLegacySheetName] = useState<string | null>(null);
  const [gridRows, setGridRows] = useState<LegacyRedirectGridRow[]>([]);
  const [gridPage, setGridPage] = useState(1);

  const applySheetToGrid = useCallback((text: string, name: string) => {
    const rows = buildLegacyRedirectGridRowsFromSheetLines(text);
    setLegacySheetText(text);
    setLegacySheetName(name);
    gridBaseRef.current = rows;
    setGridRows(rows);
    setGridPage(1);
    lastDownloadKeyRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      revokePressReleaseInventoryHostedLink(hostedHrefRef.current);
      hostedHrefRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (hostedLink?.href) {
      revokePressReleaseInventoryHostedLink(hostedHrefRef.current);
      hostedHrefRef.current = hostedLink.href;
    }
  }, [hostedLink]);

  const liveRedirectCount = useMemo(
    () => gridRows.filter((row) => row.destinationUrl.trim()).length,
    [gridRows],
  );

  const headerProgress = useMemo(() => {
    if (!running && progress.phase === "idle") return null;
    const processedCount =
      running && progress.matchedCount != null
        ? progress.matchedCount
        : progress.matchedCount ?? gridRows.length;
    return legacyRedirectHeaderProgressFromMatch(
      {
        ...progress,
        matchedCount: processedCount,
        redirectCount: liveRedirectCount,
      },
      gridRows.length,
      legacySheetName ?? undefined,
    );
  }, [running, progress, gridRows.length, legacySheetName, liveRedirectCount]);

  const progressSnapshot = useMemo(
    () => buildLegacyRedirectMicroSnapshot(headerProgress),
    [headerProgress],
  );

  const handleFile = useCallback(async (file: File) => {
    const text = await file.text();
    if (!text.trim()) {
      notify.error(NOTIFY_UPLOADED_FILE_IS_EMPTY);
      return;
    }
    applySheetToGrid(text, file.name);
  }, [applySheetToGrid]);

  const handleMatch = useCallback((match: LegacyRedirectMatchRow) => {
    setGridRows((prev) => mergeLegacyRedirectMatchesIntoGrid(prev, [match]));
  }, []);

  const handleGenerate = useCallback(async () => {
    if (workspaceMode === "temp" || !site) {
      notify.error(NOTIFY_SELECT_SITE_URL);
      return;
    }
    if (!siteReady) {
      notify.error(NOTIFY_CONNECT_WORDPRESS_CREDENTIALS_IN_INTEGRA);
      return;
    }
    if (!legacySheetText.trim()) {
      notify.error(NOTIFY_UPLOAD_A_LEGACY_URL_SHEET_FIRST);
      return;
    }
    lastDownloadKeyRef.current = null;

    const baseRows =
      gridBaseRef.current.length > 0
        ? gridBaseRef.current
        : buildLegacyRedirectGridRowsFromSheetLines(legacySheetText);
    if (!baseRows.length) {
      notify.error(NOTIFY_NO_URLS_FOUND_IN_THE_UPLOADED_SHEET);
      return;
    }

    const cleared = baseRows.map((row) => ({ ...row, destinationUrl: "" }));
    gridBaseRef.current = cleared;
    setGridRows(cleared);

    await run({
      site,
      legacySheetText,
      legacySheetName: legacySheetName ?? undefined,
      onMatch: handleMatch,
      uploadUrlCount: cleared.length,
    });
  }, [
    handleMatch,
    legacySheetName,
    legacySheetText,
    run,
    site,
    siteReady,
    workspaceMode,
  ]);

  useEffect(() => {
    if (!result?.csv || !result.rows.length) return;
    setGridRows((prev) => mergeLegacyRedirectMatchesIntoGrid(prev, result.rows));
    gridBaseRef.current = mergeLegacyRedirectMatchesIntoGrid(gridBaseRef.current, result.rows);
    const downloadKey = `${legacySheetName ?? "sheet"}:${result.rows.length}`;
    if (lastDownloadKeyRef.current === downloadKey) return;
    lastDownloadKeyRef.current = downloadKey;
    triggerDownload(
      legacyRedirectExportFilename(site?.name ?? "site"),
      result.csv,
      "text/csv;charset=utf-8",
    );
  }, [result, site?.name, legacySheetName]);

  useEffect(() => {
    const totalPages = legacyRedirectGridPageCount(gridRows.length);
    if (totalPages > 0 && gridPage > totalPages) {
      setGridPage(totalPages);
    }
  }, [gridRows.length, gridPage]);

  const handleDownloadCsv = useCallback(() => {
    const matchedRows = gridRows
      .filter((row) => row.destinationUrl.trim())
      .map((row) => ({
        legacyUrl: row.legacyUrl,
        destinationUrl: row.destinationUrl,
        uploadRow: row.uploadRow,
      }));
    const csv =
      result?.csv && !running && matchedRows.length === gridRows.length
        ? result.csv
        : buildLegacyRedirectRankMathCsv(matchedRows);
    triggerDownload(
      legacyRedirectExportFilename(site?.name ?? "site"),
      csv,
      "text/csv;charset=utf-8",
    );
  }, [gridRows, result?.csv, running, site?.name]);

  const hasSheet = Boolean(legacySheetText.trim());
  const redirectCount = running ? liveRedirectCount : result?.rows.length ?? liveRedirectCount;
  const processedCount =
    running && progress.matchedCount != null
      ? progress.matchedCount
      : progress.matchedCount ?? gridRows.length;
  const canDownloadCsv = hasSheet && gridRows.length > 0;

  const bindings = useMemo<SitemapLegacyRedirectWorkspaceBindings>(
    () => ({
      generating: running,
      progressSnapshot,
      headerProgress,
      canOpenDetails: hasSheet || running || Boolean(result) || Boolean(hostedLink),
      hasSheet,
      sheetName: legacySheetName,
      sheetLineCount: gridRows.length,
      matchedCount: redirectCount,
      processedCount,
      batchProgress,
      catalogSize: result?.catalogSize ?? progress.catalogSize ?? hostedLink?.rowCount ?? null,
      inventoryFilename: hostedLink?.filename ?? null,
      inventoryRowCount: hostedLink?.rowCount ?? null,
      inventoryHref: hostedLink?.href ?? null,
      error,
      onUploadClick: () => fileInputRef.current?.click(),
      onGenerate: () => void handleGenerate(),
      onCancel: cancel,
      onDownloadCsv: handleDownloadCsv,
      canDownloadCsv,
    }),
    [
      running,
      progressSnapshot,
      headerProgress,
      hasSheet,
      legacySheetName,
      gridRows.length,
      redirectCount,
      processedCount,
      batchProgress,
      canDownloadCsv,
      result,
      hostedLink,
      error,
      handleGenerate,
      cancel,
      handleDownloadCsv,
      progress.catalogSize,
    ],
  );

  useEffect(() => {
    if (!legacyRedirectWorkspace || !onLegacyRedirectWorkspaceBindings) return;
    onLegacyRedirectWorkspaceBindings(bindings);
  }, [legacyRedirectWorkspace, onLegacyRedirectWorkspaceBindings, bindings]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt,.tsv,text/csv,text/plain"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-3">
        <SitemapLegacyRedirectGrid
          rows={gridRows}
          page={gridPage}
          onPageChange={setGridPage}
          running={running}
        />
      </div>
    </div>
  );
}
