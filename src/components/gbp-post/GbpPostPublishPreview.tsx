import React from "react";
import { Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type GbpPublishPreview = {
  summary: string;
  moneyPageUrl: string;
  moneyPageReason?: string;
  imageSearchTerms?: string[];
  media?: {
    sourceUrl?: string;
    title?: string;
    reason?: string;
    mediaId?: number;
  };
  linkedBlog?: {
    blogPostUrl?: string;
    blogPostTitle?: string;
    blogPostExcerpt?: string;
    reason?: string;
  } | null;
};

const GBP_TEXTAREA_SURFACE =
  "min-h-[5rem] resize-y rounded-none border-0 bg-zinc-900 text-base text-foreground shadow-inner shadow-black/40 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-0";

const SKELETON_LINE = "h-4 rounded-none bg-zinc-900";
const PLACEHOLDER_LINE = "h-4 rounded-none bg-zinc-900";

interface GbpPostPublishPreviewProps {
  preview?: GbpPublishPreview | null;
  loading?: boolean;
  /** Nested in accordion row: tighter chrome. */
  embedded?: boolean;
  className?: string;
}

function PreviewLoadingSkeleton() {
  return (
    <div className="space-y-2">
      <div className={cn(GBP_TEXTAREA_SURFACE, "min-h-[5rem] animate-pulse bg-zinc-900")} />
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

function PreviewEmptyShell() {
  return (
    <>
      <Textarea readOnly value="" aria-label="Post copy preview" className={GBP_TEXTAREA_SURFACE} rows={4} />

      <div className="space-y-1.5">
        <p className="text-muted-foreground">Linked blog</p>
        <div className={cn(PLACEHOLDER_LINE, "w-full max-w-md")} aria-hidden />
        <div className={cn(PLACEHOLDER_LINE, "w-2/3 max-w-sm")} aria-hidden />
      </div>

      <div className="space-y-1.5">
        <p className="text-muted-foreground">Learn more</p>
        <div className={cn(PLACEHOLDER_LINE, "w-full max-w-sm")} aria-hidden />
      </div>

      <div className="flex items-start gap-2">
        <div className="h-16 w-16 shrink-0 rounded-none bg-zinc-900" aria-hidden />
        <div className={cn(PLACEHOLDER_LINE, "mt-1 w-28")} aria-hidden />
      </div>
    </>
  );
}

function PreviewFilledContent({ preview }: { preview: GbpPublishPreview }) {
  const imageUrl = preview.media?.sourceUrl?.trim();
  const blogTitle = preview.linkedBlog?.blogPostTitle?.trim();
  const blogUrl = preview.linkedBlog?.blogPostUrl?.trim();
  const ctaUrl = preview.moneyPageUrl?.trim();

  return (
    <>
      <Textarea readOnly value={preview.summary} className={GBP_TEXTAREA_SURFACE} rows={4} />

      {blogTitle || blogUrl ? (
        <div className="space-y-0.5">
          <p className="text-muted-foreground">Linked blog</p>
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
      ) : null}

      {ctaUrl ? (
        <div className="space-y-0.5">
          <p className="text-muted-foreground">Learn more</p>
          <a
            href={ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-primary underline-offset-4 hover:underline"
          >
            {ctaUrl}
          </a>
        </div>
      ) : null}

      {imageUrl ? (
        <div className="flex items-start gap-2">
          <img
            src={imageUrl}
            alt={preview.media?.title?.trim() || "GBP post image"}
            className="h-16 w-16 shrink-0 rounded-none object-cover"
          />
          <p className="min-w-0 truncate text-muted-foreground">
            {preview.media?.title?.trim() || "Site image"}
          </p>
        </div>
      ) : null}
    </>
  );
}

export const GbpPostPublishPreview: React.FC<GbpPostPublishPreviewProps> = ({
  preview,
  loading = false,
  embedded = false,
  className,
}) => {
  const body = loading ? (
    <PreviewLoadingSkeleton />
  ) : preview ? (
    <PreviewFilledContent preview={preview} />
  ) : embedded ? (
    <PreviewEmptyShell />
  ) : (
    <p className="text-muted-foreground">Run a post to generate a preview.</p>
  );

  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-1 flex-col gap-2 text-base",
        embedded ? "px-0 py-0" : "px-1 py-1",
        className,
      )}
    >
      {!embedded ? (
        <div className="flex shrink-0 items-center gap-2">
          {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden /> : null}
          <p className="font-medium text-foreground">Post preview</p>
        </div>
      ) : loading ? (
        <div className="flex shrink-0 items-center gap-2">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
          <p className="font-medium text-foreground">Generating preview…</p>
        </div>
      ) : null}

      {body}
    </div>
  );
};
