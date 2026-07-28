import { WorkspacePill } from "@/components/shared/WorkspacePill";
import type { SitemapOptimizerCollectionOption } from "@/lib/sitemap-optimizer/collection-options";
import {
  SITEMAP_OPTIMIZER_PAGES_LABEL,
  SITEMAP_OPTIMIZER_POSTS_LABEL,
  SITEMAP_OPTIMIZER_SAP_LABEL,
} from "@/lib/sitemap-optimizer/sitemap-optimizer-toolbar-copy";
import type { SitemapOptimizerCollectionKey } from "@/lib/sitemap-optimizer/types";

const INVENTORY_PILL_LABELS: Record<SitemapOptimizerCollectionKey, string> = {
  posts: SITEMAP_OPTIMIZER_POSTS_LABEL,
  pages: SITEMAP_OPTIMIZER_PAGES_LABEL,
  entity: SITEMAP_OPTIMIZER_SAP_LABEL,
};

export type SitemapPlanCollectionPillsProps = {
  collectionOptions: SitemapOptimizerCollectionOption[];
  selected: Set<SitemapOptimizerCollectionKey>;
  selectCollection: (key: SitemapOptimizerCollectionKey) => void;
  disabled?: boolean;
};

export function SitemapPlanCollectionPills({
  collectionOptions,
  selected,
  selectCollection,
  disabled = false,
}: SitemapPlanCollectionPillsProps) {
  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-1" aria-label="Sitemap inventory">
      {collectionOptions.map((opt) => (
        <WorkspacePill
          key={opt.key}
          label={INVENTORY_PILL_LABELS[opt.key]}
          active={selected.has(opt.key)}
          disabled={!opt.enabled || disabled}
          onClick={() => selectCollection(opt.key)}
        />
      ))}
    </div>
  );
}
