import React from "react";
import { Loader2 } from "lucide-react";
import {
  GbpPreviewImage,
  GbpPreviewLearnMore,
  GbpPreviewLinkedBlog,
  GbpPreviewLoadingSkeleton,
  GbpPreviewPostCopy,
} from "@/components/gbp-post/gbp-post-preview-blocks";
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

interface GbpPostPublishPreviewProps {
  preview?: GbpPublishPreview | null;
  loading?: boolean;
  /** Nested in accordion row: tighter chrome. */
  embedded?: boolean;
  className?: string;
}

function PreviewFilledContent({ preview }: { preview: GbpPublishPreview }) {
  const blogTitle = preview.linkedBlog?.blogPostTitle?.trim();
  const blogUrl = preview.linkedBlog?.blogPostUrl?.trim();
  const ctaUrl = preview.moneyPageUrl?.trim();
  const imageUrl = preview.media?.sourceUrl?.trim();

  return (
    <>
      <GbpPreviewPostCopy preview={preview} />

      {blogTitle || blogUrl ? (
        <div className="space-y-0.5">
          <p className="text-muted-foreground">Linked blog</p>
          <GbpPreviewLinkedBlog preview={preview} />
        </div>
      ) : null}

      {ctaUrl ? (
        <div className="space-y-0.5">
          <p className="text-muted-foreground">Learn more</p>
          <GbpPreviewLearnMore preview={preview} />
        </div>
      ) : null}

      {imageUrl ? (
        <div className="space-y-0.5">
          <p className="text-muted-foreground">Image</p>
          <GbpPreviewImage preview={preview} />
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
    <GbpPreviewLoadingSkeleton />
  ) : preview ? (
    <PreviewFilledContent preview={preview} />
  ) : embedded ? (
    <GbpPreviewPostCopy preview={null} empty />
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
