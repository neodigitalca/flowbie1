import { FileText, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reportingToolbarButtonData } from "@/components/research/reporting/reporting-toolbar-styles";
import { cn } from "@/lib/utils";
import type {
  GscReportingSectionPlan,
  GscReportingSectionResult,
} from "@/lib/gsc-reporting/gsc-reporting-types";

export interface GscReportingSectionsPanelProps {
  plans: GscReportingSectionPlan[];
  sectionMap: Record<number, GscReportingSectionResult>;
  busy: boolean;
  generatingSectionIndex: number | null;
  outlineDownloadDisabled: boolean;
  outlinePostDisabled: boolean;
  onDownloadOutlineJson: () => void;
  onDownloadOutlinePostJson: () => void;
  onDownloadSectionMd: (row: GscReportingSectionResult) => void;
  onDownloadSectionPostJson: (row: GscReportingSectionResult) => void;
}

export function GscReportingSectionsPanel({
  plans,
  sectionMap,
  busy,
  generatingSectionIndex,
  outlineDownloadDisabled,
  outlinePostDisabled,
  onDownloadOutlineJson,
  onDownloadOutlinePostJson,
  onDownloadSectionMd,
  onDownloadSectionPostJson,
}: GscReportingSectionsPanelProps) {
  if (plans.length === 0) return null;

  const sectionTotal = plans.length;
  const doneCount = plans.reduce((n, _, i) => (sectionMap[i] ? n + 1 : n), 0);
  const pct = Math.round((doneCount / Math.max(sectionTotal, 1)) * 100);

  return (
    <div className={cn("rounded-lg bg-black/25", "mt-3 space-y-3 p-3 sm:p-4")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-base font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Report sections (outline writers)
            </h3>
            <p className="text-base text-muted-foreground">
              Sequential sections after the outline step. Download each block when it finishes; stitched Markdown uses the
              toolbar actions above.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="link"
            className="h-auto min-h-0 p-0 text-base font-semibold text-[hsl(var(--semantic-data))] underline underline-offset-2"
            disabled={outlineDownloadDisabled}
            onClick={onDownloadOutlineJson}
          >
            Outline (.json)
          </Button>
          <Button
            type="button"
            variant="link"
            className="h-auto min-h-0 p-0 text-base font-semibold text-[hsl(var(--semantic-data))] underline underline-offset-2"
            disabled={outlinePostDisabled}
            onClick={onDownloadOutlinePostJson}
          >
            Outline POST (.json)
          </Button>
        </div>
      </div>

      {busy && (
        <div className="space-y-1.5">
          <div className="flowbie-competitor-progress-track rounded-sm">
            <div
              className="flowbie-competitor-progress-fill h-2 rounded-sm transition-[width] duration-300 ease-out"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <p className="text-base text-muted-foreground">
            {doneCount}/{sectionTotal} sections complete
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {plans.map((plan, i) => {
          const row = sectionMap[i];
          const done = !!row;
          const generating = busy && generatingSectionIndex === i && !done;
          const statusLabel = done ? "Done" : generating ? "Generating…" : "Waiting";

          return (
            <li
              key={`${plan.id}-${i}`}
              className="flex flex-col gap-2 rounded-md bg-black/20 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex items-start gap-2">
                {generating ? (
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
                ) : done ? (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-green-500" aria-hidden />
                ) : (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
                )}
                <div className="min-w-0">
                  <div className="truncate text-base font-medium text-foreground">
                    <span className="text-muted-foreground">{i + 1}. </span>
                    <span className="text-muted-foreground">{plan.id}</span> {plan.h2Title}
                  </div>
                  <div className="text-base text-muted-foreground">{statusLabel}</div>
                </div>
              </div>
              {done && row ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className={cn(reportingToolbarButtonData("shrink-0"), "!border-0")}
                    title="Download this section Markdown"
                    onClick={() => onDownloadSectionMd(row)}
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    .md
                  </Button>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto min-h-0 shrink-0 p-0 text-base font-semibold leading-snug text-[hsl(var(--semantic-data))] underline underline-offset-2"
                    title="OpenRouter POST JSON for this section"
                    onClick={() => onDownloadSectionPostJson(row)}
                  >
                    POST .json
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
