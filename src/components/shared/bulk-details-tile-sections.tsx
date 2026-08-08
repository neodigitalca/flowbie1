import { useState, type ReactNode } from "react";
import {
  CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS,
  contentOptimizerRowStripeClass,
} from "@/components/overview/overview-tab/overview-tab-content-constants";
import { ChevronDown, Download, FileDown, Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { BulkHarnessSectionUi } from "@/hooks/use-bulk-auto-generate";
import {
  MetaAccordionStripeRow,
  META_FIELD_COUNT,
  META_FIELD_END_RAIL,
  META_FIELD_END_RAIL_BTN,
  META_FIELD_END_RAIL_CELL,
  META_TRIGGER_FLAT,
  zoneMetaAccordionStack,
} from "@/components/overview/MetaOptimizerPageRowDetails";
import {
  CONTENT_PREP_BATCH_SECTION_TITLES,
  CONTENT_PREP_ENTITY_SAP_BATCH_SECTION_TITLES,
  CONTENT_PREP_POST_SECTION_TITLES,
  buildWaitingPostHarnessSections,
} from "@/lib/overview/overview-content-prep-harness-sections";

export type BulkDetailsDownloadable = { name: string; content: string; mimeType: string };

const PIPELINE_HARNESS_TITLES = new Set<string>([
  ...CONTENT_PREP_BATCH_SECTION_TITLES,
  ...CONTENT_PREP_ENTITY_SAP_BATCH_SECTION_TITLES,
  ...CONTENT_PREP_POST_SECTION_TITLES,
]);

function filterPipelineHarnessSections(sections: BulkHarnessSectionUi[]): BulkHarnessSectionUi[] {
  return sections.filter((s) => PIPELINE_HARNESS_TITLES.has(s.title));
}

function isSerpPipelineSection(section: BulkHarnessSectionUi): boolean {
  const title = section.title.trim().toLowerCase();
  return title.includes("serp") || title.includes("research brief");
}

/** Details drawer: SERP pipeline row only; artifact files list checklist/blueprint/content separately. */
export const DETAILS_DRAWER_PIPELINE_TITLE = CONTENT_PREP_POST_SECTION_TITLES[0];

function resolveDetailsPipelineSections(
  persisted: BulkHarnessSectionUi[] | undefined,
  live: BulkHarnessSectionUi[] | undefined,
): BulkHarnessSectionUi[] {
  const waiting = buildWaitingPostHarnessSections().filter(
    (section) => section.title === DETAILS_DRAWER_PIPELINE_TITLE,
  );
  const statusByTitle = new Map<string, BulkHarnessSectionUi>();
  for (const section of [...(persisted ?? []), ...(live ?? [])]) {
    const title = section.title?.trim();
    if (title) statusByTitle.set(title, section);
  }
  return waiting.map((section) => {
    const patch = statusByTitle.get(section.title);
    if (!patch) return section;
    return {
      ...section,
      status: patch.status,
      markdown: patch.markdown ?? section.markdown,
      truncated: patch.truncated ?? section.truncated,
    };
  });
}

function sanitizeHarnessFilenamePart(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 60) || "section";
}

function harnessSectionToDownloadable(
  section: BulkHarnessSectionUi,
  orderIndex: number,
): BulkDetailsDownloadable | null {
  const markdown = section.markdown?.trim();
  if (!markdown) return null;

  const base = `${orderIndex + 1}-${sanitizeHarnessFilenamePart(section.title || "section")}`;
  const jsonMatch = markdown.match(/^```json\n([\s\S]*)\n```$/);
  if (jsonMatch) {
    return { name: `${base}.json`, content: jsonMatch[1], mimeType: "application/json;charset=utf-8" };
  }
  const csvMatch = markdown.match(/^```csv\n([\s\S]*)\n```$/);
  if (csvMatch) {
    return { name: `${base}.csv`, content: csvMatch[1], mimeType: "text/csv;charset=utf-8" };
  }
  return { name: `${base}.md`, content: markdown, mimeType: "text/markdown;charset=utf-8" };
}

function linkPipelineSectionToGeneratedFile(
  section: BulkHarnessSectionUi,
  files: BulkDetailsDownloadable[],
): BulkDetailsDownloadable | null {
  const title = section.title.trim().toLowerCase();
  if (!title) return null;
  if (title.includes("serp") || title.includes("research brief")) {
    return (
      files.find((file) => file.name.includes("acf-seo-research")) ??
      files.find((file) => file.name.includes("keyword-research")) ??
      null
    );
  }
  if (title.includes("blueprint") || title.includes("content")) {
    return (
      files.find((file) => file.name.startsWith("blueprint")) ??
      files.find((file) => file.name.startsWith("content-")) ??
      null
    );
  }
  if (title.includes("sitemap")) {
    return files.find((file) => file.name.includes("sitemap")) ?? null;
  }
  return null;
}

function sectionFallbackDownloadable(
  section: BulkHarnessSectionUi,
  orderIndex: number,
): BulkDetailsDownloadable {
  const title = section.title.trim() || `Section ${orderIndex + 1}`;
  const content = section.markdown?.trim() || title;
  return {
    name: `${orderIndex + 1}-${sanitizeHarnessFilenamePart(title)}.txt`,
    content,
    mimeType: "text/plain;charset=utf-8",
  };
}

export function resolvePipelineSectionDownloadable(
  section: BulkHarnessSectionUi,
  orderIndex: number,
  files: BulkDetailsDownloadable[],
  claimedNames: Set<string>,
  serpBriefDownload?: BulkDetailsDownloadable | null,
): BulkDetailsDownloadable {
  const available = files.filter((file) => !claimedNames.has(file.name));

  if (isSerpPipelineSection(section) && serpBriefDownload) {
    claimedNames.add(serpBriefDownload.name);
    return serpBriefDownload;
  }

  const fromMarkdown = harnessSectionToDownloadable(section, orderIndex);
  if (fromMarkdown) {
    claimedNames.add(fromMarkdown.name);
    return fromMarkdown;
  }

  const linked = linkPipelineSectionToGeneratedFile(section, available);
  if (linked) {
    claimedNames.add(linked.name);
    return linked;
  }

  const fallback = sectionFallbackDownloadable(section, orderIndex);
  claimedNames.add(fallback.name);
  return fallback;
}

function buildPipelineSectionDownloadables(
  pipelineSections: BulkHarnessSectionUi[],
  files: BulkDetailsDownloadable[],
  serpBriefDownload?: BulkDetailsDownloadable | null,
): BulkDetailsDownloadable[] {
  const claimedNames = new Set<string>();
  return pipelineSections.map((section, index) =>
    resolvePipelineSectionDownloadable(section, index, files, claimedNames, serpBriefDownload),
  );
}

export function buildAllDownloadables(
  pipelineSections: BulkHarnessSectionUi[],
  files: BulkDetailsDownloadable[],
  serpBriefDownload?: BulkDetailsDownloadable | null,
): BulkDetailsDownloadable[] {
  const seen = new Set<string>();
  const all: BulkDetailsDownloadable[] = [];
  const push = (file: BulkDetailsDownloadable) => {
    if (seen.has(file.name)) return;
    seen.add(file.name);
    all.push(file);
  };
  buildPipelineSectionDownloadables(pipelineSections, files, serpBriefDownload).forEach(push);
  files.forEach(push);
  return all;
}

export function BulkDetailsTileSections({
  harnessSections,
  files,
  onDownloadFile,
  onDownloadAll,
  stripeBaseIndex,
  serpBriefDownload,
  statusMessage,
}: {
  harnessSections: BulkHarnessSectionUi[];
  files: BulkDetailsDownloadable[];
  onDownloadFile: (file: BulkDetailsDownloadable) => void;
  onDownloadAll: (files: BulkDetailsDownloadable[]) => void;
  stripeBaseIndex: number;
  serpBriefDownload?: BulkDetailsDownloadable | null;
  statusMessage?: string | null;
}) {
  const [filesOpen, setFilesOpen] = useState(false);
  const pipelineSections = (
    harnessSections.length
      ? filterPipelineHarnessSections(harnessSections)
      : buildWaitingPostHarnessSections()
  ).filter((section) => section.title === DETAILS_DRAWER_PIPELINE_TITLE);
  const pipelineDownloadables = buildPipelineSectionDownloadables(
    pipelineSections,
    files,
    serpBriefDownload,
  );
  const allDownloadables = buildAllDownloadables(pipelineSections, files, serpBriefDownload);
  const itemCount = pipelineSections.length + files.length;
  const trimmedStatus = statusMessage?.trim();

  if (itemCount === 0 && !trimmedStatus) {
    return null;
  }

  return (
    <div className={zoneMetaAccordionStack} role="region" aria-label="Generated files">
      <MetaAccordionStripeRow stripeIndex={stripeBaseIndex}>
        <Collapsible open={filesOpen} onOpenChange={setFilesOpen}>
          <CollapsibleTrigger asChild>
            <button type="button" className={cn(META_TRIGGER_FLAT, "w-full font-semibold")}>
              <FileDown className="h-4 w-4 shrink-0" aria-hidden />
              <span className="shrink-0 text-left">Generated files</span>
              {trimmedStatus ? (
                <span
                  className="min-w-0 flex-1 truncate text-left font-normal text-white"
                  role="status"
                  aria-live="polite"
                >
                  {trimmedStatus}
                </span>
              ) : (
                <span className="min-w-0 flex-1" aria-hidden />
              )}
              <div className={cn(META_FIELD_END_RAIL, "pointer-events-auto shrink-0")}>
                <span
                  className={cn(
                    META_FIELD_COUNT,
                    META_FIELD_END_RAIL_CELL,
                    "min-w-[1.75rem] tabular-nums font-semibold",
                  )}
                >
                  {itemCount.toLocaleString()}
                </span>
                {allDownloadables.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={META_FIELD_END_RAIL_BTN}
                    title="Download all"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDownloadAll(allDownloadables);
                    }}
                  >
                    <Download className="h-4 w-4 shrink-0" />
                  </Button>
                ) : null}
              </div>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform",
                  filesOpen && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3">
            <div className="space-y-2 text-base">
              {pipelineSections.map((s, i) => (
                <div key={s.sectionIndex} className="flex min-w-0 items-center gap-2">
                  <span className="w-6 shrink-0 tabular-nums text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1 text-white">
                    {s.title || `Section ${s.sectionIndex + 1}`}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-base text-white hover:bg-white/10 hover:text-white"
                    onClick={() => onDownloadFile(pipelineDownloadables[i]!)}
                  >
                    <Download className="mr-1 h-3 w-3" />
                    File
                  </Button>
                </div>
              ))}
              {files.map((file, idx) => (
                <div key={`${file.name}-${idx}`} className="flex min-w-0 items-center gap-2">
                  <span className="w-6 shrink-0 tabular-nums text-muted-foreground">
                    {pipelineSections.length + idx + 1}
                  </span>
                  <span
                    className="min-w-0 flex-1 whitespace-normal [overflow-wrap:anywhere] text-white"
                    title={file.name}
                  >
                    {file.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 px-2 text-base text-white hover:bg-white/10 hover:text-white"
                    onClick={() => onDownloadFile(file)}
                  >
                    <Download className="mr-1 h-3 w-3" />
                    File
                  </Button>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </MetaAccordionStripeRow>
    </div>
  );
}

export type BulkDetailsDrawerStackProps = {
  liveMessage?: string | null;
  /** When false, skip the live stripe even if `liveMessage` is set (Content Optimizer parallel-run gating). */
  showLiveMessage?: boolean;
  prepSections?: BulkHarnessSectionUi[] | null;
  prepOpen?: boolean;
  onPrepOpenChange?: (open: boolean) => void;
  pagination?: ReactNode;
  /** Receives stripe index after live/prep/pagination stripes for row numbering. */
  children: (stripeBase: number) => ReactNode;
};

export function BulkDetailsDrawerStack({
  liveMessage,
  showLiveMessage = true,
  prepSections,
  prepOpen = true,
  onPrepOpenChange,
  pagination,
  children,
}: BulkDetailsDrawerStackProps) {
  let stripeBase = 0;
  const trimmedLive = liveMessage?.trim();
  const liveStripe =
    showLiveMessage && trimmedLive ? (
      <div className={contentOptimizerRowStripeClass(stripeBase++)}>
        <div className="border-0 px-2.5 py-1.5 text-base text-white sm:px-3">{trimmedLive}</div>
      </div>
    ) : null;

  const prepStripeIndex = prepSections?.length ? stripeBase++ : null;

  return (
    <div className={CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS}>
      {liveStripe}
      {prepSections?.length ? (
        <BulkDetailsPrepAccordion
          sections={prepSections}
          stripeIndex={prepStripeIndex!}
          open={prepOpen}
          onOpenChange={onPrepOpenChange ?? (() => {})}
        />
      ) : null}
      {pagination}
      {children(stripeBase)}
    </div>
  );
}

export function BulkDetailsPrepAccordion({
  sections,
  stripeIndex,
  open,
  onOpenChange,
}: {
  sections: BulkHarnessSectionUi[];
  stripeIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <MetaAccordionStripeRow stripeIndex={stripeIndex}>
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger asChild>
          <button type="button" className={cn(META_TRIGGER_FLAT, "w-full font-semibold")}>
            <MapIcon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-left">Sitemap prep</span>
            <div className={cn(META_FIELD_END_RAIL, "pointer-events-auto shrink-0")}>
              <span
                className={cn(
                  META_FIELD_COUNT,
                  META_FIELD_END_RAIL_CELL,
                  "min-w-[1.75rem] tabular-nums font-semibold",
                )}
              >
                {sections.length.toLocaleString()}
              </span>
            </div>
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          <div className="space-y-2 text-base">
            {sections.map((s, i) => (
              <div key={s.sectionIndex} className="flex min-w-0 items-start gap-2">
                <span className="w-6 shrink-0 tabular-nums text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 flex-1 text-white">
                  {s.title || `Section ${s.sectionIndex + 1}`}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </MetaAccordionStripeRow>
  );
}

export { filterPipelineHarnessSections, resolveDetailsPipelineSections, isSerpPipelineSection };
