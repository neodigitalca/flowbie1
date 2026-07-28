import { WorkspacePill } from "@/components/shared/WorkspacePill";
import { getStoredSites, type WordPressSite } from "@/components/IntegrationsTab";
import type { ConnectedSiteSummary } from "@/components/integrations/types";
import type { WordPressPostDestination } from "@/lib/bulk-auto-generate";
import type { BulkRowSitemapType, BulkSitemapMode } from "@/lib/bulk/bulk-sitemap-mode";

export type BulkGeneratorSitemapMenuProps = {
  postDestination: WordPressPostDestination;
  connectedSite?: ConnectedSiteSummary | null;
  selectedWordPressSites: Set<string>;
  siteConfigs: Record<string, { sitemapType: BulkSitemapMode }>;
  setSiteConfigs: (
    value:
      | Record<string, { sitemapType: BulkSitemapMode }>
      | ((
          prev: Record<string, { sitemapType: BulkSitemapMode }>,
        ) => Record<string, { sitemapType: BulkSitemapMode }>),
  ) => void;
  onSwitchToCustom?: (defaultRowType: BulkRowSitemapType) => void;
  isDisabled?: boolean;
};

function resolveTargetSite(connectedSite?: ConnectedSiteSummary | null): WordPressSite | null {
  if (!connectedSite) return null;
  const sites = getStoredSites();
  if (sites.length === 0) return null;
  const normalize = (url: string) =>
    url.trim().toLowerCase().replace(/\/$/, "").replace(/^https?:\/\/(www\.)?/, "");
  return sites.find((s) => normalize(s.siteUrl) === normalize(connectedSite.siteUrl)) ?? null;
}

export function BulkGeneratorSitemapMenu({
  postDestination,
  connectedSite,
  selectedWordPressSites,
  siteConfigs,
  setSiteConfigs,
  onSwitchToCustom,
  isDisabled = false,
}: BulkGeneratorSitemapMenuProps) {
  if (postDestination === "local") {
    return null;
  }

  const targetSite = resolveTargetSite(connectedSite);
  if (!targetSite) {
    return null;
  }

  const selectedId = Array.from(selectedWordPressSites)[0] ?? targetSite.id;
  const entityAvailable = Boolean(targetSite.entitySitemapUrl?.trim());
  const sitemapType =
    siteConfigs[selectedId]?.sitemapType ?? (entityAvailable ? "entity" : "post");

  const setSitemapType = (value: BulkSitemapMode) => {
    if (isDisabled || value === sitemapType) return;
    if (value === "custom" && sitemapType !== "custom") {
      const defaultRowType: BulkRowSitemapType =
        sitemapType === "entity" ? "entity" : "post";
      onSwitchToCustom?.(defaultRowType);
    }
    setSiteConfigs((prev) => ({
      ...prev,
      [selectedId]: {
        ...prev[selectedId],
        sitemapType: value,
      },
    }));
  };

  return (
    <div
      className="flex min-w-0 shrink-0 flex-nowrap items-center gap-1"
      role="group"
      aria-label="Sitemap"
    >
      <WorkspacePill
        label="Posts"
        active={sitemapType === "post"}
        disabled={isDisabled}
        onClick={() => setSitemapType("post")}
      />
      <WorkspacePill
        label="Entity"
        active={sitemapType === "entity"}
        disabled={isDisabled || !entityAvailable}
        onClick={() => setSitemapType("entity")}
      />
      <WorkspacePill
        label="Custom"
        active={sitemapType === "custom"}
        disabled={isDisabled || !entityAvailable}
        onClick={() => setSitemapType("custom")}
      />
    </div>
  );
}
