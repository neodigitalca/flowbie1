import {
  META_VISUAL_CELL_CLASS,
  META_VISUAL_GRID_CLASS,
  META_VISUAL_TEXTAREA_CLASS,
  metaVisualSettingsRowClass,
} from "@/components/ppc/meta/meta-ads-visual-settings-layout";
import {
  GbpPreviewImage,
  GbpPreviewLearnMore,
  GbpPreviewLinkedBlog,
  GbpPreviewLoadingSkeleton,
  GbpPreviewPostCopy,
  GbpPreviewStatusHeader,
} from "@/components/gbp-post/gbp-post-preview-blocks";
import type { GbpPublishPreview } from "@/components/gbp-post/GbpPostPublishPreview";
import { cn } from "@/lib/utils";

export type GbpPostRowDetailsProps = {
  preview?: GbpPublishPreview | null;
  loading?: boolean;
  panelId?: string;
};

export function GbpPostRowDetails({ preview, loading = false, panelId }: GbpPostRowDetailsProps) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3 px-2.5 pb-3 pt-0 sm:px-3" id={panelId}>
        <GbpPreviewStatusHeader loading />
        <GbpPreviewLoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-2.5 pb-3 pt-0 sm:px-3" id={panelId}>
      <div className={cn(metaVisualSettingsRowClass(0), META_VISUAL_GRID_CLASS, "items-start")}>
        <span className={cn(META_VISUAL_CELL_CLASS, "pt-2 text-base font-semibold text-foreground")}>
          Post copy
        </span>
        <div className={cn("col-span-3 min-w-0", META_VISUAL_TEXTAREA_CLASS, "h-auto border-0 bg-transparent p-0 shadow-none")}>
          <GbpPreviewPostCopy preview={preview} empty />
        </div>
      </div>

      <div className={cn(metaVisualSettingsRowClass(1), META_VISUAL_GRID_CLASS, "items-start")}>
        <span className={cn(META_VISUAL_CELL_CLASS, "pt-2 text-base font-semibold text-foreground")}>
          Linked blog
        </span>
        <div className="col-span-3 min-w-0">
          <GbpPreviewLinkedBlog preview={preview} />
        </div>
      </div>

      <div className={cn(metaVisualSettingsRowClass(2), META_VISUAL_GRID_CLASS, "items-start")}>
        <span className={cn(META_VISUAL_CELL_CLASS, "pt-2 text-base font-semibold text-foreground")}>
          Learn more
        </span>
        <div className="col-span-3 min-w-0">
          <GbpPreviewLearnMore preview={preview} />
        </div>
      </div>

      <div className={cn(metaVisualSettingsRowClass(3), META_VISUAL_GRID_CLASS, "items-start")}>
        <span className={cn(META_VISUAL_CELL_CLASS, "pt-2 text-base font-semibold text-foreground")}>
          Image
        </span>
        <div className="col-span-3 min-w-0">
          <GbpPreviewImage preview={preview} />
        </div>
      </div>
    </div>
  );
}
