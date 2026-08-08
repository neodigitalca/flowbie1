import { deduplicateInternalLinksInHtml, removeInvalidInternalLinks } from "@/lib/content-generation/content-sanitizer";
import { resolveInternalLinkPlaceholdersInHtml } from "@/lib/content-generation/internal-link-placeholders";
import { integrateOrphanInternalLinksInHtml } from "@/lib/content-generation/integrate-orphan-internal-links";

export type WordPressPostLinkRow = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  link: string;
  date_gmt: string;
};

export async function finalizeBulkSeoExtraTextHtml(options: {
  extraTextHtml: string;
  currentPageUrl: string;
  siteUrl: string;
  siteId: string;
  apiKey: string;
  wordPressPosts: WordPressPostLinkRow[];
  stagingSite?: boolean;
  /** Bulk batch: skip per-row link ensure (grid already loaded). */
  skipLinkPipeline?: boolean;
  onProgress: (step: string, progress: number, message: string) => void;
}): Promise<{ html: string }> {
  let extra = options.extraTextHtml.trim();
  if (!extra) {
    return { html: "" };
  }

  if (options.skipLinkPipeline) {
    return { html: deduplicateInternalLinksInHtml(extra) };
  }

  const { wordPressPosts, siteUrl, siteId, apiKey, currentPageUrl, onProgress } = options;

  if (wordPressPosts.length > 0) {
    onProgress("Resolving internal links...", 88, "Matching link placeholders to sitemap...");
    try {
      extra = resolveInternalLinkPlaceholdersInHtml(extra, {
        siteId,
        siteUrl,
        currentPageUrl,
        wordPressPosts,
      });
      extra = deduplicateInternalLinksInHtml(extra);
      extra = integrateOrphanInternalLinksInHtml(extra, {
        siteUrl,
        currentPageUrl,
        wordPressPosts,
      });
    } catch (err) {
      console.warn("[Bulk SEO extra text] Resolve link placeholders failed:", err);
    }
  }

  extra = deduplicateInternalLinksInHtml(extra);
  const sanitized = removeInvalidInternalLinks(extra, wordPressPosts, siteUrl);

  return {
    html: (sanitized || extra).trim(),
  };
}
