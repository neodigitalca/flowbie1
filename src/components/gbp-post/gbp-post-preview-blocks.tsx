import { Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { GbpPublishPreview } from "@/components/gbp-post/GbpPostPublishPreview";

export const GBP_PREVIEW_TEXTAREA_CLASS =
  "min-h-[5rem] resize-y rounded-none border-0 bg-zinc-900 text-base text-foreground shadow-inner shadow-black/40 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-0";

const SKELETON_LINE = "h-4 rounded-none bg-zinc-900";
const PLACEHOLDER_LINE = "h-4 rounded-none bg-zinc-900";

export function GbpPreviewLoadingSkeleton() {
  return (
    <div className="space-y-2">
      <div className={cn(GBP_PREVIEW_TEXTAREA_CLASS, "min-h-[5rem] animate-pulse bg-zinc-900")} />
      <div className="space-y-1.5">
        <div className={cn(SKELETON_LINE, "w-24")} />
        <div className={cn(SKELETON_LINE, "w-full max-w-md")} />
      </div>
      <div className="space-y-1.5">
        <div className={cn(SKELETON_LINE, "w-20")} />
        <div className={cn(SKELETON_LINE, "w-full max-w-sm")} />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-16 w-16 shrink-0 rounded-none bg-zinc-900 animate-pulse" />
        <div className={cn(SKELETON_LINE, "w-28")} />
      </div>
    </div>
  );
}

export function GbpPreviewPostCopy({ preview, empty }: { preview?: GbpPublishPreview | null; empty?: boolean }) {
  return (
    <Textarea
      readOnly
      value={preview?.summary ?? ""}
      aria-label="Post copy"
      placeholder={empty ? "Post copy appears after you run Post" : undefined}
      className={GBP_PREVIEW_TEXTAREA_CLASS}
      rows={4}
    />
  );
}

export function GbpPreviewLinkedBlog({ preview }: { preview?: GbpPublishPreview | null }) {
  const blogTitle = preview?.linkedBlog?.blogPostTitle?.trim();
  const blogUrl = preview?.linkedBlog?.blogPostUrl?.trim();

  if (!blogTitle && !blogUrl) {
    return <div className={cn(PLACEHOLDER_LINE, "w-full max-w-md")} aria-hidden />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {blogTitle ? <p className="font-medium text-foreground">{blogTitle}</p> : null}
      {blogUrl ? (
        <a
          href={blogUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-primary underline-offset-4 hover:underline"
        >
          {blogUrl}
        </a>
      ) : null}
    </div>
  );
}

export function GbpPreviewLearnMore({ preview }: { preview?: GbpPublishPreview | null }) {
  const ctaUrl = preview?.moneyPageUrl?.trim();

  if (!ctaUrl) {
    return <div className={cn(PLACEHOLDER_LINE, "w-full max-w-sm")} aria-hidden />;
  }

  return (
    <a
      href={ctaUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block truncate text-primary underline-offset-4 hover:underline"
    >
      {ctaUrl}
    </a>
  );
}

export function GbpPreviewImage({ preview }: { preview?: GbpPublishPreview | null }) {
  const imageUrl = preview?.media?.sourceUrl?.trim();

  if (!imageUrl) {
    return (
      <div className="flex items-start gap-2">
        <div className="h-16 w-16 shrink-0 rounded-none bg-zinc-900" aria-hidden />
        <div className={cn(PLACEHOLDER_LINE, "mt-1 w-28")} aria-hidden />
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <img
        src={imageUrl}
        alt={preview?.media?.title?.trim() || "GBP post image"}
        className="h-16 w-16 shrink-0 rounded-none object-cover"
      />
      <p className="min-w-0 truncate text-muted-foreground">
        {preview?.media?.title?.trim() || "Site image"}
      </p>
    </div>
  );
}

export function GbpPreviewStatusHeader({ loading }: { loading?: boolean }) {
  if (!loading) return null;
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
      <p className="font-medium text-foreground">Generating preview…</p>
    </div>
  );
}
