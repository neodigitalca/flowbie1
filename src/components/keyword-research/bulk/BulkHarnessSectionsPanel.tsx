import { FileText, Loader2, Download, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  reportingToolbarButtonData,
} from '@/components/research/reporting/reporting-toolbar-styles';
import { BULK_ACTIVE_SEMANTIC_BORDER_CLASS } from '@/lib/bulk/bulk-active-semantic-border';
import {
  detailsDrawerRowStripeClass,
  DETAILS_CO_COLLAPSE_TRIGGER,
  DETAILS_CO_SECTION_BODY,
  DETAILS_CO_SECTION_LINE,
  DETAILS_CO_STACK,
} from '@/components/integrations/wordpress/bulk-details-drawer-styles';
import { cn } from '@/lib/utils';
import type { BulkHarnessSectionUi } from '@/hooks/use-bulk-auto-generate';

function triggerDownloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function triggerDownloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function harnessSectionDownload(filenameBase: string, markdown: string) {
  const jsonMatch = markdown.match(/^```json\n([\s\S]*)\n```$/);
  if (jsonMatch) {
    triggerDownloadFile(`${filenameBase}.json`, jsonMatch[1], 'application/json;charset=utf-8');
    return;
  }
  const csvMatch = markdown.match(/^```csv\n([\s\S]*)\n```$/);
  if (csvMatch) {
    triggerDownloadFile(`${filenameBase}.csv`, csvMatch[1], 'text/csv;charset=utf-8');
    return;
  }
  triggerDownloadMarkdown(`${filenameBase}.md`, markdown);
}

function sanitizeFilenamePart(s: string): string {
  return s.replace(/[^a-z0-9._-]+/gi, '_').slice(0, 60) || 'section';
}

interface BulkHarnessSectionsPanelProps {
  harnessSections: BulkHarnessSectionUi[];
  /** When set, used as the section total for "done/total" and progress (fixed blueprint size). */
  harnessPlannedSectionCount?: number | null;
  currentRow: number;
  totalRows: number;
  isProcessing: boolean;
  /** Hides the explanatory blurb under the panel title (Sitemap publish workspace). */
  compact?: boolean;
  /** Override default "Harness sections (middle-out)" title. */
  panelTitle?: string;
  /** Override default row / parallel harness description. */
  panelDescription?: string;
  /** Hide title, icon, and description; list sections only. */
  hideHeader?: boolean;
  /** Details drawer: thin blue border on active section instead of green spinner. */
  activeIndicator?: 'spinner' | 'border';
  /** Details drawer: flat list, no progress bar or per-section frames. */
  variant?: 'default' | 'details-flat';
  /** Compact details rows with white copy. Completed sections still expose downloads. */
  blogImportCompact?: boolean;
  /** When true, hide per-section File download buttons (status + micro lines stay). */
  hideSectionDownloads?: boolean;
}

export function BulkHarnessSectionsPanel({
  harnessSections,
  harnessPlannedSectionCount = null,
  currentRow,
  totalRows,
  isProcessing,
  compact = false,
  panelTitle,
  panelDescription,
  hideHeader = false,
  activeIndicator = 'spinner',
  variant = 'default',
  blogImportCompact = false,
  hideSectionDownloads = false,
}: BulkHarnessSectionsPanelProps) {
  const isDetailsFlat = variant === 'details-flat';
  const sectionTotal =
    typeof harnessPlannedSectionCount === 'number' && harnessPlannedSectionCount > 0
      ? harnessPlannedSectionCount
      : harnessSections.length;
  const doneCount = harnessSections.filter((s) => s.status === 'done').length;
  const pct = Math.round((doneCount / Math.max(sectionTotal, 1)) * 100);

  if (harnessSections.length === 0 && !isDetailsFlat) return null;

  const sectionList = (
    <ul className={cn(isDetailsFlat ? DETAILS_CO_STACK : 'space-y-0', !isDetailsFlat && DETAILS_CO_STACK)}>
      {harnessSections.map((s, sectionIndex) => {
        const title = s.title || `Section ${s.sectionIndex + 1}`;
        const isGenerating = s.status === 'generating';
        return (
          <li
            key={s.sectionIndex}
            className={cn(
              'flex items-start gap-2',
              isDetailsFlat
                ? cn(
                    blogImportCompact
                      ? "flex min-h-7 w-full items-center gap-2 border-0 px-2.5 py-0.5 text-base text-white sm:px-3"
                      : DETAILS_CO_SECTION_LINE,
                    detailsDrawerRowStripeClass(sectionIndex, {
                      isActiveOptimize: isGenerating,
                    }),
                  )
                : cn(
                    'rounded-md bg-black/20 px-2 py-1.5',
                    activeIndicator === 'border' &&
                      isGenerating &&
                      'border',
                    activeIndicator === 'border' &&
                      isGenerating &&
                      BULK_ACTIVE_SEMANTIC_BORDER_CLASS,
                  ),
            )}
          >
            {s.status === 'generating' && activeIndicator === 'spinner' && !isDetailsFlat ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
            ) : !isDetailsFlat && s.status === 'waiting' ? (
              <span className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
            ) : null}
            <span className="min-w-0 flex-1 whitespace-normal text-base leading-snug text-white [overflow-wrap:anywhere]">
              <span className={cn(!isDetailsFlat && !blogImportCompact && 'text-muted-foreground')}>
                {s.sectionIndex + 1}.{' '}
              </span>
              {title}
              {s.status === 'generating' && !isDetailsFlat && !blogImportCompact ? (
                <span className="text-white/70"> …</span>
              ) : null}
              {isDetailsFlat && isGenerating && s.markdown?.trim() ? (
                <span className="mt-0.5 block space-y-0.5 text-base [overflow-wrap:anywhere]">
                  {s.markdown
                    .trim()
                    .split("\n")
                    .filter((line) => line.trim().length > 0)
                    .map((line, lineIndex, lines) => {
                      const isActiveMicro = lineIndex === lines.length - 1;
                      return (
                        <span
                          key={`${s.sectionIndex}-micro-${lineIndex}`}
                          className={cn(
                            "flex items-start gap-2",
                            isActiveMicro
                              ? "font-semibold text-primary"
                              : "text-white/50",
                          )}
                        >
                          {isActiveMicro ? (
                            <Loader2
                              className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-primary"
                              aria-hidden
                            />
                          ) : (
                            <span className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                          )}
                          <span className="min-w-0 flex-1 whitespace-normal">{line}</span>
                        </span>
                      );
                    })}
                </span>
              ) : null}
            </span>
            {s.status === 'done' && s.markdown?.trim() && !hideSectionDownloads ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className={cn(
                  reportingToolbarButtonData('h-7 shrink-0 px-2'),
                  '!border-0',
                  isDetailsFlat && 'text-white hover:bg-white/10 hover:text-white',
                )}
                onClick={() =>
                  harnessSectionDownload(
                    `bulk-harness-row${currentRow + 1}-section${s.sectionIndex + 1}-${sanitizeFilenamePart(s.title || 'section')}`,
                    s.markdown!,
                  )
                }
              >
                <Download className="h-3.5 w-3.5" />
                {/^```json\n/.test(s.markdown!.trim()) ? '.json' : /^```csv\n/.test(s.markdown!.trim()) ? '.csv' : '.md'}
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );

  if (isDetailsFlat) {
    return (
      <div className={DETAILS_CO_SECTION_BODY}>
        {harnessSections.length > 0 ? (
          sectionList
        ) : (
          <div className={cn(DETAILS_CO_SECTION_LINE, detailsDrawerRowStripeClass(0))}>
            <span>No sections yet</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      {!hideHeader ? (
        <div className="flex items-start gap-2">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-base font-normal uppercase tracking-[0.14em] text-muted-foreground">
              {panelTitle ?? "Harness sections (middle-out)"}
            </h3>
            {!compact ? (
              <p className="text-base text-muted-foreground">
                {panelDescription ??
                  `Row ${currentRow + 1} of ${totalRows}. Parallel harness: each section streams from OpenRouter in its own worker (titles follow the blueprint).`}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {isProcessing && !isDetailsFlat && (
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

      {sectionList}
    </div>
  );
}
