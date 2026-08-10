import type { AgentConfig } from "@/types/agent-config";
import { markdownToHtml } from "@/lib/markdown-to-html";
import { buildBulkHarnessOutlineFromAgents } from "@/lib/bulk/bulk-harness-outline";
import {
  buildHarnessSectionAnchorMap,
  formatHarnessInPageAnchorBlock,
} from "@/lib/bulk/harness-section-anchor-ids";
import { splitBlogHarnessBodyAndOverview } from "@/lib/bulk/blog-harness-summary-agent";
import {
  extractOverviewSectionHtml,
  injectHarnessH2AnchorIdsForStitchedBlog,
} from "@/lib/overview/overview-blog-overview-prepend";
import { applyOverviewHarnessScrollLinksToStitchedHtml } from "@/lib/overview/overview-harness-scroll-links";
import { expandOverviewScrollLinkPlaceholdersInMarkdown } from "@/lib/prompt-builders/overview-link-rules";
import { isGeneratedContentHtml } from "@/lib/content-generation/content-format";
import {
  resolveInternalLinkPlaceholdersInHtml,
  resolveInternalLinkPlaceholdersInMarkdown,
} from "@/lib/content-generation/internal-link-placeholders";
import {
  resolveExternalLinkPlaceholdersInHtml,
  type ExternalLinkPair,
} from "@/lib/content-generation/external-link-placeholders";
import { repairHarnessHtmlForUpload } from "@/lib/content-generation/repair-harness-html";
import { ensureNoLinkEndsInPeriod } from "@/lib/content-generation/content-sanitizer";

export type HarnessUploadPrepWordPressPost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  link: string;
  date_gmt: string;
};

export type PrepareHarnessContentForUploadArgs = {
  markdownContent: string;
  blueprintAgents: AgentConfig[];
  wordPressPosts?: HarnessUploadPrepWordPressPost[];
  siteId?: string;
  siteUrl?: string;
  currentPageUrl?: string;
  externalUrlPairs?: ExternalLinkPair[];
  apiKey?: string;
  keyword?: string;
  articleTitle?: string;
  model?: string;
  signal?: AbortSignal;
};

/**
 * Shared harness → HTML pipeline used by Prompt Generator bulk upload and Content Optimizer.
 * Expands Overview scroll links, injects body H2 anchors, resolves placeholders, repairs artifacts.
 */
export async function prepareHarnessContentForUpload(
  args: PrepareHarnessContentForUploadArgs,
): Promise<string> {
  const {
    markdownContent,
    blueprintAgents,
    wordPressPosts,
    siteId,
    siteUrl,
    currentPageUrl,
    externalUrlPairs = [],
    apiKey,
    keyword,
    articleTitle,
    model,
    signal,
  } = args;

  if (!markdownContent?.trim()) return markdownContent;

  const { bodyAgents } = splitBlogHarnessBodyAndOverview(blueprintAgents);
  const bodyAnchors = buildHarnessSectionAnchorMap(buildBulkHarnessOutlineFromAgents(bodyAgents));

  let mdForUpload = markdownContent;
  if (wordPressPosts?.length && siteId && siteUrl) {
    try {
      mdForUpload = resolveInternalLinkPlaceholdersInMarkdown(mdForUpload, {
        siteId,
        siteUrl,
        currentPageUrl,
        wordPressPosts,
      });
    } catch (err) {
      console.warn("[Harness upload prep] Internal link markdown resolve failed:", err);
    }
  }

  mdForUpload = expandOverviewScrollLinkPlaceholdersInMarkdown(mdForUpload);

  let htmlContent = isGeneratedContentHtml(mdForUpload)
    ? mdForUpload
    : await markdownToHtml(mdForUpload);

  htmlContent = injectHarnessH2AnchorIdsForStitchedBlog(htmlContent, bodyAnchors);

  const overviewSection = extractOverviewSectionHtml(htmlContent);
  if (bodyAnchors.length > 0 && overviewSection) {
    const resolvedApiKey = apiKey?.trim();
    if (!resolvedApiKey) {
      throw new Error(
        "Overview scroll links require an OpenRouter API key during harness upload prep.",
      );
    }
    const resolvedKeyword = keyword?.trim() || articleTitle?.trim() || "topic";
    const resolvedTitle = articleTitle?.trim() || resolvedKeyword;
    htmlContent = await applyOverviewHarnessScrollLinksToStitchedHtml({
      html: htmlContent,
      anchorMap: bodyAnchors,
      articleTitle: resolvedTitle,
      keyword: resolvedKeyword,
      apiKey: resolvedApiKey,
      model,
      signal,
      inPageAnchorBlock: formatHarnessInPageAnchorBlock(bodyAnchors),
    });
  }

  if (wordPressPosts?.length && siteId && siteUrl) {
    try {
      htmlContent = resolveInternalLinkPlaceholdersInHtml(htmlContent, {
        siteId,
        siteUrl,
        currentPageUrl,
        wordPressPosts,
      });
    } catch (err) {
      console.warn("[Harness upload prep] Internal link HTML resolve failed:", err);
    }
  }

  htmlContent = resolveExternalLinkPlaceholdersInHtml(htmlContent, externalUrlPairs);
  htmlContent = repairHarnessHtmlForUpload(htmlContent);
  htmlContent = ensureNoLinkEndsInPeriod(htmlContent);

  return htmlContent;
}
