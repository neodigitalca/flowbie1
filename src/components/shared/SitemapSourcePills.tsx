import { WorkspacePill } from "@/components/shared/WorkspacePill";
import {
  OVERVIEW_SITEMAP_SOURCE_LABELS,
  type OverviewSitemapSource,
} from "@/lib/overview/overview-sitemap-source";
import { cn } from "@/lib/utils";

export type SitemapSourcePillsProps = {
  value: OverviewSitemapSource;
  onChange: (source: OverviewSitemapSource) => void;
  disabled?: boolean;
  postsAvailable: boolean;
  sapAvailable: boolean;
  className?: string;
};

export function SitemapSourcePills({
  value,
  onChange,
  disabled = false,
  postsAvailable,
  sapAvailable,
  className,
}: SitemapSourcePillsProps) {
  return (
    <div
      className={cn("flex min-w-0 flex-nowrap items-center gap-1", className)}
      role="group"
      aria-label="Sitemap source"
    >
      {(Object.keys(OVERVIEW_SITEMAP_SOURCE_LABELS) as OverviewSitemapSource[]).map((source) => {
        const sourceDisabled =
          disabled ||
          (source === "posts" && !postsAvailable) ||
          (source === "sap" && !sapAvailable);

        return (
          <WorkspacePill
            key={source}
            label={OVERVIEW_SITEMAP_SOURCE_LABELS[source]}
            active={value === source}
            disabled={sourceDisabled}
            onClick={() => {
              if (value !== source) onChange(source);
            }}
          />
        );
      })}
    </div>
  );
}
