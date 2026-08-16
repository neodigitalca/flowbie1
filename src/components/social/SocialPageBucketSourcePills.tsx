import { WorkspacePill } from "@/components/shared/WorkspacePill";
import type { SocialLandingPageSource } from "@/lib/social/content-creator-types";
import { cn } from "@/lib/utils";

const SOURCE_LABELS: Record<SocialLandingPageSource, string> = {
  posts: "Posts",
  pages: "Pages",
  random: "Random",
};

export type SocialPageBucketSourcePillsProps = {
  value: SocialLandingPageSource;
  onChange: (source: SocialLandingPageSource) => void;
  disabled?: boolean;
  className?: string;
};

export function SocialPageBucketSourcePills({
  value,
  onChange,
  disabled = false,
  className,
}: SocialPageBucketSourcePillsProps) {
  return (
    <div
      className={cn("flex min-w-0 flex-nowrap items-center gap-1", className)}
      role="group"
      aria-label="Landing page source"
    >
      {(Object.keys(SOURCE_LABELS) as SocialLandingPageSource[]).map((source) => (
        <WorkspacePill
          key={source}
          label={SOURCE_LABELS[source]}
          active={value === source}
          disabled={disabled}
          onClick={() => {
            if (value !== source) onChange(source);
          }}
        />
      ))}
    </div>
  );
}
