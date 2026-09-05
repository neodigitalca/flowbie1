import type { WordPressSite } from "@/components/integrations/types";
import {
  countOkDfsArticleAuditPlatforms,
  fetchDfsArticleAuditPlatforms,
} from "@/lib/dfs-article-audit/dfs-article-audit-dataforseo";
import type { DfsArticleAuditV1 } from "@/lib/dfs-article-audit/dfs-article-audit-types";
import {
  auditPlatformsForRun,
  formatDfsArticleAuditPlatformLabels,
  type DfsArticleAuditPlatform,
} from "@/lib/dfs-article-audit/dfs-article-audit-types";

export type FetchDfsArticleAuditInput = {
  articleUrl: string;
  focusKeyword: string;
  site?: WordPressSite | null;
  siteId?: string;
  siteName?: string;
  location?: string;
  auditQuestions?: string[];
  seoResearchBrief?: string;
  auditPlatforms?: DfsArticleAuditPlatform[];
  onProgress?: (message: string) => void;
};

export async function fetchDfsArticleAudit(input: FetchDfsArticleAuditInput): Promise<DfsArticleAuditV1> {
  const articleUrl = input.articleUrl.trim();
  const focusKeyword = input.focusKeyword.trim();
  if (!articleUrl) throw new Error("Article URL is required for DFS article audit.");
  if (!focusKeyword) throw new Error("Focus keyword is required for DFS article audit.");

  const auditPlatforms = auditPlatformsForRun(input.auditPlatforms);

  input.onProgress?.(
    `Auditing one article on ${formatDfsArticleAuditPlatformLabels(auditPlatforms)}…`,
  );
  const platforms = await fetchDfsArticleAuditPlatforms({
    articleUrl,
    focusKeyword,
    siteName: input.siteName,
    location: input.location,
    auditQuestions: input.auditQuestions,
    seoResearchBrief: input.seoResearchBrief,
    platforms: auditPlatforms,
    onPlatform: (result) => {
      if (result.status === "ok") {
        input.onProgress?.(`${result.label}: audit received`);
      } else {
        input.onProgress?.(`${result.label}: ${result.error ?? "failed"}`);
      }
    },
  });

  const okCount = countOkDfsArticleAuditPlatforms(platforms);
  if (okCount === 0) {
    const errors = platforms
      .map((p) => `${p.label}: ${p.error ?? "empty response"}`)
      .join("; ");
    throw new Error(`DFS article audit failed on all platforms. ${errors}`);
  }

  return {
    version: 1,
    articleUrl,
    focusKeyword,
    siteName: input.siteName?.trim() || input.site?.name?.trim() || undefined,
    generatedAt: new Date().toISOString(),
    platforms,
    merged: null,
  };
}
