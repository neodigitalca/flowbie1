import { WorkspacePill } from "@/components/shared/WorkspacePill";
import type { ContentTypeFilter } from "@/hooks/vertical-benchmark/use-vertical-benchmark-controller";

const PILLS: { value: ContentTypeFilter; label: string }[] = [
  { value: "post", label: "Posts" },
  { value: "entity", label: "Entity URLs" },
  { value: "", label: "Both" },
];

export type VerticalBenchmarkContentPillsProps = {
  contentTypeFilter: ContentTypeFilter;
  onContentTypeFilterChange: (value: ContentTypeFilter) => void;
  disabled?: boolean;
};

export function VerticalBenchmarkContentPills({
  contentTypeFilter,
  onContentTypeFilterChange,
  disabled = false,
}: VerticalBenchmarkContentPillsProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1" aria-label="Content type">
      {PILLS.map(({ value, label }) => (
        <WorkspacePill
          key={label}
          label={label}
          active={contentTypeFilter === value}
          disabled={disabled}
          onClick={() => onContentTypeFilterChange(value)}
        />
      ))}
    </div>
  );
}
