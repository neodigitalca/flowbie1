import { WorkspacePill } from "@/components/shared/WorkspacePill";
import type { SitemapOptimizerWorkspaceMode } from "@/lib/sitemap-optimizer/types";

const MODES: { id: SitemapOptimizerWorkspaceMode; label: string }[] = [
  { id: "plan", label: "Plan" },
  { id: "legacy_redirects", label: "Legacy redirects" },
  { id: "url_optimizer", label: "URL" },
];

export type SitemapWorkspaceModePillsProps = {
  workspaceSubMode: SitemapOptimizerWorkspaceMode;
  onWorkspaceSubModeChange: (mode: SitemapOptimizerWorkspaceMode) => void;
  disabled?: boolean;
};

export function SitemapWorkspaceModePills({
  workspaceSubMode,
  onWorkspaceSubModeChange,
  disabled = false,
}: SitemapWorkspaceModePillsProps) {
  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-1" aria-label="Sitemap workspace mode">
      {MODES.map(({ id, label }) => (
        <WorkspacePill
          key={id}
          label={label}
          active={workspaceSubMode === id}
          disabled={disabled}
          onClick={() => onWorkspaceSubModeChange(id)}
        />
      ))}
    </div>
  );
}
