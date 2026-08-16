import { Download, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PPC_DETAIL_TEXTAREA_CLASS } from "@/components/ppc/google/google-ads-row-details-styles";
import { clampInstagramCaption } from "@/lib/social/content-creator-social-copy-limits";
import type { SocialCreatorRow } from "@/lib/social/social-creator-types";
import { cn } from "@/lib/utils";

export type SocialCreatorInstagramPreviewProps = {
  row: SocialCreatorRow;
  caption: string;
  onCaptionChange: (caption: string) => void;
  onDownloadImage?: () => void;
};

export function SocialCreatorInstagramPreview({
  row,
  caption,
  onCaptionChange,
  onDownloadImage,
}: SocialCreatorInstagramPreviewProps) {
  const imageSrc = row.creative?.imagePreviewUrl ?? row.creative?.imageBase64 ?? null;

  return (
    <div className="mx-auto w-full max-w-sm bg-zinc-950">
      <div className="relative aspect-square w-full bg-zinc-900">
        {imageSrc ? (
          <img src={imageSrc} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageIcon className="h-8 w-8" aria-hidden />
            <span className="text-base">No image</span>
          </div>
        )}
        {imageSrc && onDownloadImage ? (
          <Button
            type="button"
            variant="ghost"
            className="absolute right-2 top-2 h-8 gap-1.5 bg-zinc-950/80 px-2"
            onClick={onDownloadImage}
          >
            <Download className="h-4 w-4" aria-hidden />
            Download
          </Button>
        ) : null}
      </div>

      <div className="space-y-2 pt-3">
        <label className="text-base text-muted-foreground">Caption</label>
        <Textarea
          value={caption}
          className={cn(PPC_DETAIL_TEXTAREA_CLASS, "min-h-[4.5rem]")}
          aria-label="Instagram caption"
          onChange={(e) => onCaptionChange(clampInstagramCaption(e.target.value))}
        />
      </div>
    </div>
  );
}
