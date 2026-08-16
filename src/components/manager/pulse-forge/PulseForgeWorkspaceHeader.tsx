import React from "react";
import { Zap } from "lucide-react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UnifiedWorkspaceChrome } from "@/components/shared/UnifiedWorkspaceChrome";
import { WorkspacePill } from "@/components/shared/WorkspacePill";
import type { PulseForgeNavMode } from "@/components/manager/pulse-forge/PulseForgeNavSidebar";

export type PulseForgeWorkspaceHeaderProps = {
  navMode: PulseForgeNavMode;
  onNavModeChange: (mode: PulseForgeNavMode) => void;
  onNewAutomation: () => void;
  toolbar?: React.ReactNode;
};

export function PulseForgeWorkspaceHeader({
  navMode,
  onNavModeChange,
  onNewAutomation,
  toolbar,
}: PulseForgeWorkspaceHeaderProps): React.ReactElement {
  return (
    <UnifiedWorkspaceChrome
      icon={Zap}
      iconClassName="text-primary"
      title="Pulse Forge"
      titleRowMenu={
        <div className="flex items-center gap-1">
          <WorkspacePill active={navMode === "recipes"} onClick={() => onNavModeChange("recipes")}>
            Recipes
          </WorkspacePill>
          <WorkspacePill active={navMode === "forge"} onClick={() => onNavModeChange("forge")}>
            My Forge
          </WorkspacePill>
        </div>
      }
      titleRowEnd={
        <Button
          type="button"
          variant="ghost"
          className="h-9 rounded-none px-2 text-primary hover:bg-zinc-900 hover:text-primary"
          onClick={onNewAutomation}
          aria-label="New automation"
        >
          <Plus className="h-4 w-4" />
        </Button>
      }
      toolbar={toolbar ?? <span />}
      workspaceBusy={false}
      progressBand="empty"
      hideToolbar={!toolbar}
    />
  );
}
