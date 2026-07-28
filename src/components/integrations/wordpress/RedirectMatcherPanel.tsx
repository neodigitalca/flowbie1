import React, { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";
import { notify } from "@/lib/app-notifications";
import type { WordPressSite } from "../types";
import { useRedirectMatcherRun } from "@/hooks/integrations/use-redirect-matcher-run";
import { parseLegacyUrlCsv } from "@/lib/redirect-matcher/parse-legacy-url-csv";
import {
  buildRedirectMatcherRankMathCsv,
  redirectMatcherExportFilename,
} from "@/lib/redirect-matcher/redirect-matcher-export-csv";
import { getCyberpunkTextClasses } from "./cyberpunk-theme";
import { WP_PANEL_TOOLBAR_BTN } from "./wordpress-panel-chrome";
export interface RedirectMatcherPanelProps {
  site: WordPressSite;
  disabled?: boolean;
}

function triggerDownload(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const RedirectMatcherPanel: React.FC<RedirectMatcherPanelProps> = ({
  site,
  disabled = false,
}) => {
  const { progress, result, error, running, run, cancel } = useRedirectMatcherRun();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastDownloadKeyRef = useRef<string | null>(null);
  const activeFileRef = useRef<string | null>(null);

  const handleCsvFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      const parsed = parseLegacyUrlCsv(text, site);
      if (parsed.error || !parsed.rows.length) {
        notify.error(parsed.error ?? "No legacy URL rows in CSV.", { duration: 12000 });
        return;
      }

      activeFileRef.current = file.name;
      lastDownloadKeyRef.current = null;
      await run({ site, legacyRows: parsed.rows });
    },
    [run, site],
  );

  useEffect(() => {
    if (!result?.rows.length || !activeFileRef.current) return;

    const downloadKey = `${activeFileRef.current}:${result.rows.length}:${result.stats.matched}`;
    if (lastDownloadKeyRef.current === downloadKey) return;
    lastDownloadKeyRef.current = downloadKey;

    const csv = buildRedirectMatcherRankMathCsv(result.rows);
    triggerDownload(
      redirectMatcherExportFilename(site.name, "rankmath"),
      csv,
      "text/csv;charset=utf-8",
    );
  }, [result, site.name]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleCsvFile(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="default"
          size="default"
          className={WP_PANEL_TOOLBAR_BTN}
          disabled={disabled || running}
          onClick={() => fileInputRef.current?.click()}
        >
          {running ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <Upload className="h-4 w-4 shrink-0" aria-hidden />
          )}
          {running ? "Matching…" : "Upload CSV"}
        </Button>
        {running ? (
          <Button
            type="button"
            variant="outline"
            size="default"
            className={WP_PANEL_TOOLBAR_BTN}
            onClick={cancel}
          >
            Cancel
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-base text-destructive">
          {error}
        </p>
      ) : null}

      {running ? (
        <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-base">
          <p className="font-medium capitalize text-foreground">{progress.phase}</p>
          {progress.message ? (
            <p className={getCyberpunkTextClasses("muted")}>{progress.message}</p>
          ) : null}
          {progress.total > 0 ? (
            <p className="tabular-nums text-muted-foreground">
              {progress.completed} / {progress.total}
              {progress.catalogSize ? ` · ${progress.catalogSize} blogs in catalog` : ""}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
