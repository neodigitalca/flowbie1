import React from "react";
import { WorkspacePill } from "@/components/shared/WorkspacePill";
import type { TaskExecutionPayload } from "@/lib/tasks-types";

type AspectKey =
  | "optimizeTitle"
  | "optimizeMeta"
  | "optimizeExcerpt"
  | "optimizeContent"
  | "optimizeExtraText"
  | "optimizeFeaturedImage";

const ASPECT_PILLS: { key: AspectKey; label: string }[] = [
  { key: "optimizeTitle", label: "Title" },
  { key: "optimizeMeta", label: "Meta" },
  { key: "optimizeExcerpt", label: "Meta description" },
  { key: "optimizeContent", label: "Body" },
  { key: "optimizeExtraText", label: "Extra text" },
  { key: "optimizeFeaturedImage", label: "Featured image" },
];

export type AutomationWhatAspectPillsProps = {
  executionPayload: TaskExecutionPayload;
  disabled?: boolean;
  pillTone?: "default" | "forge" | "monochrome";
  onChange: (executionPayload: TaskExecutionPayload) => void;
};

export function AutomationWhatAspectPills({
  executionPayload,
  disabled = false,
  pillTone = "default",
  onChange,
}: AutomationWhatAspectPillsProps): React.ReactElement {
  const options = executionPayload.optimizationOptions ?? {};

  const toggle = (key: AspectKey) => {
    const next = options[key] === true;
    onChange({
      ...executionPayload,
      optimizationOptions: {
        ...options,
        [key]: !next,
      },
    });
  };

  return (
    <div className="flex min-w-0 flex-wrap gap-1" aria-label="SEO aspects">
      {ASPECT_PILLS.map(({ key, label }) => (
        <WorkspacePill
          key={key}
          label={label}
          square
          tone={pillTone}
          active={options[key] === true}
          disabled={disabled}
          onClick={() => toggle(key)}
        />
      ))}
    </div>
  );
}
