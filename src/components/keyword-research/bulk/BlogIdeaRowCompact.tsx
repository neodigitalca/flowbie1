import { ChevronDown, ChevronUp, ExternalLink, GripVertical, Loader2, MapPin } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { CSVRow } from "@/lib/bulk-auto-generate";
import {
  modifierLinksFromJson,
  serializeModifierLinksJson,
} from "@/lib/bulk/bulk-csv-parser";
import { BlogIdeaModifierLinksEditor } from "@/components/keyword-research/bulk/BlogIdeaModifierLinksEditor";
import {
  CONTENT_OPTIMIZER_PAGE_ROW_TITLE_CELL,
  contentOptimizerCopyableCellProps,
  contentOptimizerRowStripeClass,
} from "@/components/overview/overview-tab/overview-tab-content-constants";
import { WorkspaceNestedInput } from "@/components/seo/WorkspaceNestedField";
import { DASHBOARD_LIST_CHECKBOX_CLASS } from "@/components/shared/workspace-checkbox-styles";
import { buildSapSlugFromKeywordEntity } from "@/lib/sap-slug-from-keyword-entity";
import { googleDirectionsSearchUrl } from "@/lib/google-directions-search-url";
import { PPC_CAMPAIGN_ROW_FIELD_CELL } from "@/components/ppc/google/google-ads-row-constants";
import { PPC_DETAIL_INPUT_CLASS } from "@/components/ppc/google/google-ads-row-details-styles";
import { cn } from "@/lib/utils";
import type { CSSProperties, ReactNode } from "react";

const EXPANDED_FIELD_LABEL = "w-[5.75rem] shrink-0 sm:w-[6.5rem]";
const EXPANDED_INPUT_CLASS = "min-h-9 min-w-0";

/** Left select | title (1fr) | keyword (1fr) | expand. */
const BLOG_IDEA_ROW_GRID_CLASS = cn(
  "grid w-full min-w-0 min-h-[3rem] grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_minmax(4.75rem,auto)] items-center gap-x-2 sm:min-h-[3.25rem] sm:gap-x-3",
);
/** Left select | title | keyword | publish date | expand. */
const BLOG_IDEA_ROW_GRID_WITH_DATE_CLASS = cn(
  "grid w-full min-w-0 min-h-[3rem] grid-cols-[2.25rem_minmax(0,1.2fr)_minmax(0,1fr)_minmax(7.5rem,0.7fr)_minmax(4.75rem,auto)] items-center gap-x-2 sm:min-h-[3.25rem] sm:gap-x-3",
);
const BLOG_IDEA_ROW_SLOT_GRID_CLASS = cn(
  "grid w-full min-w-0 min-h-[3rem] grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)_minmax(4.75rem,auto)] items-center gap-x-2 sm:min-h-[3.25rem] sm:gap-x-3",
);
const BLOG_PROMPT_SLOT_INPUT_CLASS = cn(PPC_DETAIL_INPUT_CLASS, "h-9 w-full min-w-0 text-zinc-100");
const BLOG_IDEA_ROW_GRID_NO_SELECT_CLASS = cn(
  "grid w-full min-w-0 min-h-[3rem] grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(4.75rem,auto)] items-center gap-x-2 sm:min-h-[3.25rem] sm:gap-x-3",
);
const BLOG_IDEA_ROW_GRID_NO_SELECT_WITH_DATE_CLASS = cn(
  "grid w-full min-w-0 min-h-[3rem] grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(7.5rem,0.7fr)_minmax(4.75rem,auto)] items-center gap-x-2 sm:min-h-[3.25rem] sm:gap-x-3",
);

export const BLOG_IDEA_ROW_SELECT_CHECKBOX_CLASS = DASHBOARD_LIST_CHECKBOX_CLASS;

const BLOG_IDEA_ROW_SELECT_CELL = "flex shrink-0 items-center justify-center pl-0.5";

const BLOG_IDEA_ROW_EXPAND_CELL =
  "flex shrink-0 flex-nowrap items-center justify-end gap-1 sm:gap-2";

export type BlogIdeaRowDragProps = {
  setNodeRef: (node: HTMLElement | null) => void;
  style?: CSSProperties;
  isDragging?: boolean;
  handleProps?: Record<string, unknown>;
  handleDisabled?: boolean;
};

export type BlogIdeaRowCompactProps = {
  row: CSVRow;
  index: number;
  stripeIndex: number;
  isSelected: boolean;
  isExpanded: boolean;
  isProcessing: boolean;
  busy?: boolean;
  publishDateLabel?: string;
  draftOnly?: boolean;
  showPublishDate?: boolean;
  placeholder?: boolean;
  /** Hide selection checkbox (CSV grid). */
  showSelect?: boolean;
  /** Content Optimizer active row glow (CSV run). */
  activeOptimize?: boolean;
  drag?: BlogIdeaRowDragProps;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onRowChange: (patch: Partial<CSVRow>) => void;
  /** Connected site / business name for Google directions search links. */
  directionsSiteName?: string;
  /** When set, shown in the keyword column instead of `row.keyword`. */
  keywordDisplay?: string;
  /** Hide directions pin on the row (entity ad group header shows location). */
  showDirections?: boolean;
  /** Pre-Ideas slot row: PPC-style keyword + blog fields. */
  slotMode?: boolean;
  /** Live WordPress post/preview URL after upload (from wordpress-post file). */
  previewUrl?: string;
};

function sapUrlPathFromRow(row: CSVRow): string {
  const slug = buildSapSlugFromKeywordEntity(row.keyword ?? "", row.entity ?? "");
  const path = slug ? `/${slug}/` : "";
  return path;
}

function previewPathLabel(previewUrl: string, row: CSVRow): string {
  try {
    const path = new URL(previewUrl).pathname;
    if (path && path !== "/") return path.endsWith("/") ? path : `${path}/`;
  } catch {
    /* keep computed path */
  }
  return sapUrlPathFromRow(row) || previewUrl;
}

function publishDisplayValue(
  _row: CSVRow,
  publishDateLabel?: string,
  draftOnly = false,
): string {
  if (draftOnly) return "Draft";
  const label = publishDateLabel?.trim();
  if (label) return label;
  return "";
}

function featuredImageDisplay(row: CSVRow): string {
  if (!row.featuredImage) return "Yes";
  if (row.featuredImage === "y") return "Yes";
  if (row.featuredImage === "n") return "No";
  return row.featuredImage;
}

function featuredImageFromInput(value: string): string {
  const v = value.trim().toLowerCase();
  if (v === "n" || v === "no") return "n";
  return "y";
}

function stopFieldBubble(e: React.SyntheticEvent) {
  e.stopPropagation();
}

function modifierFromInput(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}

function modifierFromBlur(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function DragHandle({
  drag,
  onClickStop,
}: {
  drag?: BlogIdeaRowDragProps;
  onClickStop: (e: React.MouseEvent) => void;
}) {
  if (!drag) return null;
  return (
    <button
      type="button"
      ref={undefined}
      className="mr-1.5 touch-none shrink-0 p-0.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
      disabled={drag.handleDisabled}
      aria-label="Drag to reorder"
      onClick={onClickStop}
      {...drag.handleProps}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}

function TitleCell({
  drag,
  titleLabel,
  placeholder = false,
}: {
  drag?: BlogIdeaRowDragProps;
  titleLabel: string;
  placeholder?: boolean;
}) {
  const { className: copyableClassName, ...copyableProps } = contentOptimizerCopyableCellProps();
  return (
    <div
      className={cn(CONTENT_OPTIMIZER_PAGE_ROW_TITLE_CELL, copyableClassName)}
      {...copyableProps}
    >
      <DragHandle drag={drag} onClickStop={(e) => e.stopPropagation()} />
      <span
        className={cn(
          "select-text whitespace-normal break-words text-base leading-snug",
          placeholder ? "text-zinc-500" : "text-zinc-100",
        )}
      >
        {titleLabel}
      </span>
    </div>
  );
}

function KeywordCell({
  keywordLabel,
  placeholder = false,
}: {
  keywordLabel: string;
  placeholder?: boolean;
}) {
  const { className: copyableClassName, ...copyableProps } = contentOptimizerCopyableCellProps();
  return (
    <div
      className={cn(
        "flex min-w-0 items-center border-0 bg-transparent px-1.5 py-0.5",
        copyableClassName,
      )}
      {...copyableProps}
    >
      <span
        className={cn(
          "select-text whitespace-normal break-words text-base font-bold leading-snug",
          placeholder ? "text-zinc-500" : "text-zinc-100",
        )}
      >
        {keywordLabel}
      </span>
    </div>
  );
}

function PublishDateCell({
  publishDateLabel,
  placeholder = false,
}: {
  publishDateLabel?: string;
  placeholder?: boolean;
}) {
  const label = publishDateLabel?.trim() || "";
  return (
    <div className="flex min-w-0 items-center border-0 bg-transparent px-1.5 py-0.5">
      <span
        className={cn(
          "select-text whitespace-nowrap text-base leading-snug text-white",
          placeholder || !label ? "text-zinc-500" : null,
        )}
      >
        {label || "-"}
      </span>
    </div>
  );
}

function SelectCell({
  isSelected,
  index,
  placeholder = false,
  onToggleSelect,
}: {
  isSelected: boolean;
  index: number;
  placeholder?: boolean;
  onToggleSelect: () => void;
}) {
  return (
    <div className={BLOG_IDEA_ROW_SELECT_CELL}>
      {!placeholder ? (
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect()}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select idea ${index + 1}`}
          className={BLOG_IDEA_ROW_SELECT_CHECKBOX_CLASS}
        />
      ) : (
        <span className="h-4 w-4 shrink-0" aria-hidden />
      )}
    </div>
  );
}

function DirectionsLinkButton({
  entity,
  siteName,
}: {
  entity?: string;
  siteName?: string;
}) {
  const href = googleDirectionsSearchUrl(entity ?? "", siteName ?? "");
  if (!href) return null;
  const label = `Directions: ${entity?.trim()} to ${siteName?.trim()}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-7 w-7 shrink-0 items-center justify-center text-sky-400 hover:text-sky-300"
      aria-label={label}
      title={label}
      onClick={(e) => e.stopPropagation()}
    >
      <MapPin className="h-4 w-4" aria-hidden />
    </a>
  );
}

function ActionsCell({
  busy,
  isExpanded,
  entity,
  directionsSiteName,
  showDirections = true,
  onToggleExpand,
}: {
  busy: boolean;
  isExpanded: boolean;
  entity?: string;
  directionsSiteName?: string;
  showDirections?: boolean;
  onToggleExpand: () => void;
}) {
  return (
    <div className={BLOG_IDEA_ROW_EXPAND_CELL}>
      {showDirections ? <DirectionsLinkButton entity={entity} siteName={directionsSiteName} /> : null}
      {busy ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-zinc-400" aria-label="Working" />
      ) : null}
      <button
        type="button"
        className="flex h-7 w-7 shrink-0 items-center justify-center text-zinc-300 hover:text-white sm:h-8 sm:w-8"
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Collapse row" : "Expand row"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleExpand();
        }}
      >
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4" aria-hidden />
        )}
      </button>
    </div>
  );
}

function ExpandedFields({
  row,
  fieldId,
  isProcessing,
  publishDateLabel,
  draftOnly = false,
  onRowChange,
  previewUrl,
}: {
  row: CSVRow;
  fieldId: (name: string) => string;
  isProcessing: boolean;
  publishDateLabel?: string;
  draftOnly?: boolean;
  onRowChange: (patch: Partial<CSVRow>) => void;
  previewUrl?: string;
}) {
  const livePreview = previewUrl?.trim() || "";
  const slugDisplay =
    row.target_slug?.trim() ||
    sapUrlPathFromRow(row).replace(/^\/+|\/+$/g, "");
  const linkUrls = modifierLinksFromJson(row.modifier_links_json);

  const handleLinksChange = (urls: string[]) => {
    onRowChange({ modifier_links_json: serializeModifierLinksJson(urls) });
  };

  return (
    <div
      className="grid grid-cols-1 gap-1.5 px-2.5 pb-2 pt-1 sm:grid-cols-2 sm:px-3"
      role="group"
      aria-label="Blog idea details"
      onClick={stopFieldBubble}
    >
      <WorkspaceNestedInput
        id={fieldId("title")}
        layout="inline"
        label="Title"
        labelClassName={EXPANDED_FIELD_LABEL}
        value={row.title ?? ""}
        disabled={isProcessing}
        className={EXPANDED_INPUT_CLASS}
        onChange={(e) => onRowChange({ title: e.target.value })}
        onClick={stopFieldBubble}
      />
      <WorkspaceNestedInput
        id={fieldId("keyword")}
        layout="inline"
        label="Keyword"
        labelClassName={EXPANDED_FIELD_LABEL}
        value={row.keyword ?? ""}
        disabled={isProcessing}
        className={EXPANDED_INPUT_CLASS}
        onChange={(e) => onRowChange({ keyword: e.target.value })}
        onClick={stopFieldBubble}
      />
      <WorkspaceNestedInput
        id={fieldId("entity")}
        layout="inline"
        label="Entity"
        labelClassName={EXPANDED_FIELD_LABEL}
        value={row.entity ?? ""}
        disabled={isProcessing}
        className={EXPANDED_INPUT_CLASS}
        onChange={(e) => onRowChange({ entity: e.target.value.trim() || undefined })}
        onClick={stopFieldBubble}
      />
      {livePreview ? (
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn(EXPANDED_FIELD_LABEL, "text-base text-muted-foreground")}>URL</span>
          <a
            href={livePreview}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 items-center gap-1.5 text-base text-lime-400 underline hover:text-lime-300"
            onClick={stopFieldBubble}
          >
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{previewPathLabel(livePreview, row)}</span>
          </a>
        </div>
      ) : (
        <WorkspaceNestedInput
          id={fieldId("slug")}
          layout="inline"
          label="Slug"
          labelClassName={EXPANDED_FIELD_LABEL}
          value={slugDisplay}
          disabled={isProcessing}
          placeholder="post-slug"
          className={EXPANDED_INPUT_CLASS}
          onChange={(e) => onRowChange({ target_slug: e.target.value.trim() || undefined })}
          onClick={stopFieldBubble}
        />
      )}
      {row.wikipedia_url?.trim() ? (
        <div className="flex min-w-0 items-center gap-2 sm:col-span-2">
          <span className={cn(EXPANDED_FIELD_LABEL, "text-base text-muted-foreground")}>Wikipedia</span>
          <a
            href={row.wikipedia_url.trim()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 items-center gap-1.5 text-base text-lime-400 underline hover:text-lime-300"
            onClick={stopFieldBubble}
          >
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{row.wikipedia_url.trim()}</span>
          </a>
        </div>
      ) : null}
      <WorkspaceNestedInput
        id={fieldId("modifier")}
        layout="inline"
        label="Modifier"
        labelClassName={EXPANDED_FIELD_LABEL}
        value={row.modifier ?? ""}
        disabled={isProcessing}
        placeholder="e.g. comprehensive guide"
        className={EXPANDED_INPUT_CLASS}
        onChange={(e) => onRowChange({ modifier: modifierFromInput(e.target.value) })}
        onBlur={(e) => onRowChange({ modifier: modifierFromBlur(e.target.value) })}
        onClick={stopFieldBubble}
      />
      <WorkspaceNestedInput
        id={fieldId("meta")}
        layout="inline"
        label="Meta"
        labelClassName={EXPANDED_FIELD_LABEL}
        value={row.meta_description ?? ""}
        disabled={isProcessing}
        placeholder="SEO meta description"
        className={EXPANDED_INPUT_CLASS}
        onChange={(e) => onRowChange({ meta_description: e.target.value.trim() || undefined })}
        onClick={stopFieldBubble}
      />
      <WorkspaceNestedInput
        id={fieldId("publish")}
        layout="inline"
        label={draftOnly ? "Status" : "Publish"}
        labelClassName={EXPANDED_FIELD_LABEL}
        value={publishDisplayValue(row, publishDateLabel, draftOnly)}
        disabled={isProcessing || draftOnly}
        placeholder={draftOnly ? "Draft" : "Scheduled date"}
        className={EXPANDED_INPUT_CLASS}
        onChange={(e) => onRowChange({ publish_date_gmt: e.target.value.trim() || undefined })}
        onClick={stopFieldBubble}
      />
      <WorkspaceNestedInput
        id={fieldId("featured-image")}
        layout="inline"
        label="Image"
        labelClassName={EXPANDED_FIELD_LABEL}
        value={featuredImageDisplay(row)}
        disabled={isProcessing}
        placeholder="Yes or No"
        className={EXPANDED_INPUT_CLASS}
        onChange={(e) => onRowChange({ featuredImage: featuredImageFromInput(e.target.value) })}
        onClick={stopFieldBubble}
      />
      <BlogIdeaModifierLinksEditor
        idPrefix={fieldId("links")}
        links={linkUrls}
        disabled={isProcessing}
        onChange={handleLinksChange}
      />
    </div>
  );
}

export function BlogIdeaRowCompact({
  row,
  index,
  stripeIndex,
  isSelected,
  isExpanded,
  isProcessing,
  busy = false,
  publishDateLabel,
  draftOnly = false,
  showPublishDate = false,
  placeholder = false,
  showSelect = true,
  activeOptimize = false,
  drag,
  onToggleSelect,
  onToggleExpand,
  onRowChange,
  directionsSiteName,
  keywordDisplay,
  showDirections = true,
  slotMode = false,
  previewUrl,
}: BlogIdeaRowCompactProps) {
  const gridClass = slotMode
    ? BLOG_IDEA_ROW_SLOT_GRID_CLASS
    : showSelect
      ? showPublishDate
        ? BLOG_IDEA_ROW_GRID_WITH_DATE_CLASS
        : BLOG_IDEA_ROW_GRID_CLASS
      : showPublishDate
        ? BLOG_IDEA_ROW_GRID_NO_SELECT_WITH_DATE_CLASS
        : BLOG_IDEA_ROW_GRID_NO_SELECT_CLASS;

  if (placeholder) {
    if (slotMode) {
      return (
        <div
          className={cn(contentOptimizerRowStripeClass(stripeIndex), "min-h-[3rem] flex-1 sm:min-h-[3.25rem]")}
          aria-hidden
        />
      );
    }
    return (
      <div className={cn(contentOptimizerRowStripeClass(stripeIndex), gridClass)} aria-hidden>
        {showSelect ? (
          <SelectCell isSelected={false} index={index} placeholder onToggleSelect={() => {}} />
        ) : null}
      </div>
    );
  }

  const keywordLabel = keywordDisplay?.trim() || row.keyword?.trim() || "";
  const titleLabel = row.title?.trim() ?? "";
  const fieldId = (name: string) => `blog-idea-${index}-${name}`;

  const rowShell = (header: ReactNode) => (
    <div
      ref={drag?.setNodeRef}
      style={drag?.style}
      className={cn(
        contentOptimizerRowStripeClass(stripeIndex, { isActiveOptimize: activeOptimize }),
        drag?.isDragging && "opacity-90",
      )}
    >
      {header}
      {isExpanded ? (
        <ExpandedFields
          row={row}
          fieldId={fieldId}
          isProcessing={isProcessing}
          publishDateLabel={publishDateLabel}
          draftOnly={draftOnly}
          onRowChange={onRowChange}
          previewUrl={previewUrl}
        />
      ) : null}
    </div>
  );

  if (slotMode) {
    const slotHeader = (
      <div className={BLOG_IDEA_ROW_SLOT_GRID_CLASS}>
        <div className={cn(PPC_CAMPAIGN_ROW_FIELD_CELL, "pl-[5px]")}>
          <Input
            type="text"
            value={row.keyword ?? ""}
            disabled={isProcessing || busy}
            placeholder="Keyword"
            className={BLOG_PROMPT_SLOT_INPUT_CLASS}
            aria-label="Keyword"
            onClick={stopFieldBubble}
            onChange={(e) => onRowChange({ keyword: e.target.value })}
          />
        </div>
        <div className={PPC_CAMPAIGN_ROW_FIELD_CELL}>
          <Input
            type="text"
            value={row.modifier ?? ""}
            disabled={isProcessing || busy}
            placeholder="Modifications"
            className={BLOG_PROMPT_SLOT_INPUT_CLASS}
            aria-label="Modifications"
            onClick={stopFieldBubble}
            onChange={(e) => onRowChange({ modifier: modifierFromInput(e.target.value) })}
            onBlur={(e) => onRowChange({ modifier: modifierFromBlur(e.target.value) })}
          />
        </div>
        <ActionsCell
          busy={busy}
          isExpanded={isExpanded}
          entity={row.entity}
          directionsSiteName={directionsSiteName}
          showDirections={false}
          onToggleExpand={onToggleExpand}
        />
      </div>
    );

    if (isExpanded) {
      return rowShell(slotHeader);
    }

    return (
      <div
        ref={drag?.setNodeRef}
        style={drag?.style}
        className={cn(
          contentOptimizerRowStripeClass(stripeIndex, { isActiveOptimize: activeOptimize }),
          drag?.isDragging && "opacity-90",
        )}
      >
        {slotHeader}
      </div>
    );
  }

  const gridHeader = (
    <div className={gridClass}>
      {showSelect ? (
        <SelectCell
          isSelected={isSelected}
          index={index}
          placeholder={placeholder}
          onToggleSelect={onToggleSelect}
        />
      ) : null}

      <TitleCell drag={drag} titleLabel={titleLabel} placeholder={placeholder} />

      <KeywordCell keywordLabel={keywordLabel} placeholder={placeholder} />

      {showPublishDate ? (
        <PublishDateCell
          publishDateLabel={publishDisplayValue(row, publishDateLabel, draftOnly)}
          placeholder={placeholder}
        />
      ) : null}

      <ActionsCell
        busy={busy}
        isExpanded={isExpanded}
        entity={row.entity}
        directionsSiteName={directionsSiteName}
        showDirections={showDirections}
        onToggleExpand={onToggleExpand}
      />
    </div>
  );

  if (isExpanded) {
    return rowShell(gridHeader);
  }

  return (
    <div
      ref={drag?.setNodeRef}
      style={drag?.style}
      className={cn(
        contentOptimizerRowStripeClass(stripeIndex, { isActiveOptimize: activeOptimize }),
        gridClass,
        drag?.isDragging && "opacity-90",
      )}
    >
      {showSelect ? (
        <SelectCell
          isSelected={isSelected}
          index={index}
          placeholder={placeholder}
          onToggleSelect={onToggleSelect}
        />
      ) : null}

      <TitleCell drag={drag} titleLabel={titleLabel} placeholder={placeholder} />

      <KeywordCell keywordLabel={keywordLabel} placeholder={placeholder} />

      {showPublishDate ? (
        <PublishDateCell
          publishDateLabel={publishDisplayValue(row, publishDateLabel, draftOnly)}
          placeholder={placeholder}
        />
      ) : null}

      <ActionsCell
        busy={busy}
        isExpanded={false}
        entity={row.entity}
        directionsSiteName={directionsSiteName}
        showDirections={showDirections}
        onToggleExpand={onToggleExpand}
      />
    </div>
  );
}
