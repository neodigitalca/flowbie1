import { useState } from "react";
import { Sparkles, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BULK_HEADER_FIELD,
  BULK_HEADER_ICON_TOOL_BTN,
  BULK_HEADER_RUN_BTN,
  BULK_HEADER_TOOL_BTN,
  BULK_TOOLBAR_GROUP_DIVIDER,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import { SocialCreatorDarkSelect } from "@/components/social/creator/SocialCreatorDarkSelect";
import { SocialCreatorToolbarExportMenu } from "@/components/social/creator/SocialCreatorToolbarExportMenu";
import { SocialCreatorToolbarKeywordsMenu } from "@/components/social/creator/SocialCreatorToolbarKeywordsMenu";
import { SocialCreatorWorkspaceDefaultsDialog } from "@/components/social/creator/SocialCreatorWorkspaceDefaultsDialog";
import { OverviewContentSortControls } from "@/components/overview/overview-tab/OverviewContentSortControls";
import { WorkspacePill } from "@/components/shared/WorkspacePill";
import {
  clampSocialPostCount,
  SOCIAL_POST_COUNT_MAX,
  SOCIAL_POST_COUNT_MIN,
  type MetaAdPlacement,
  type SocialGenerateConfig,
} from "@/lib/social/social-creator-types";
import { metaAdPlacementLabel } from "@/lib/social/social-creator-field-limits";
import type { SocialCreatorWorkspaceController } from "@/hooks/social/use-social-creator-workspace";
import { cn } from "@/lib/utils";

export type SocialCreatorGenerateToolbarProps = {
  ctrl: SocialCreatorWorkspaceController;
  disabled?: boolean;
};

const TOOLBAR_NUM_INPUT = cn(
  BULK_HEADER_FIELD,
  "h-8 w-[3.75rem] min-w-[3.75rem] shrink-0 px-2 text-right tabular-nums",
);

const PLACEMENT_OPTIONS: MetaAdPlacement[] = ["feed_1x1", "feed_4x5", "story_9x16"];

export function SocialCreatorGenerateToolbar({ ctrl, disabled = false }: SocialCreatorGenerateToolbarProps) {
  const [defaultsOpen, setDefaultsOpen] = useState(false);
  const {
    generateConfig,
    setGenerateConfig,
    setWorkspaceVisualDefaults,
    handleGeneratePosts,
    handleCancelGenerate,
    handleImportKeywords,
    handleClearAllPosts,
    handleExportSocialCreatorCsv,
    canExportSocialCreatorCsv,
    handleExportSocialCreatorZip,
    canExportSocialCreatorZip,
    isGenerating,
    sortColumn,
    setSortColumn,
    sortDir,
    setSortDir,
    displayPosts,
  } = ctrl;
  const configToolbarDisabled = disabled || isGenerating;

  const patchConfig = (patch: Partial<SocialGenerateConfig>) => {
    setGenerateConfig((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
      <div className={cn(BULK_HEADER_TOOL_BTN, "flex items-center gap-1 px-2")}>
        <label htmlFor="social-creator-toolbar-posts" className="shrink-0 text-base text-muted-foreground">
          Posts
        </label>
        <input
          id="social-creator-toolbar-posts"
          type="number"
          min={SOCIAL_POST_COUNT_MIN}
          max={SOCIAL_POST_COUNT_MAX}
          value={generateConfig.postCount}
          disabled={configToolbarDisabled}
          className={TOOLBAR_NUM_INPUT}
          aria-label="Posts to generate"
          onChange={(e) =>
            patchConfig({
              postCount: clampSocialPostCount(Number(e.target.value) || SOCIAL_POST_COUNT_MIN),
            })
          }
        />
      </div>

      <div className={cn(BULK_HEADER_TOOL_BTN, "flex items-center gap-1 px-2")}>
        <label htmlFor="social-creator-toolbar-format" className="shrink-0 text-base text-muted-foreground">
          Format
        </label>
        <SocialCreatorDarkSelect
          id="social-creator-toolbar-format"
          value={generateConfig.placement}
          disabled={configToolbarDisabled}
          triggerClassName="h-8 min-w-[6.5rem] shrink-0 border-0 bg-transparent pr-1 shadow-none"
          ariaLabel="Post placement format"
          options={PLACEMENT_OPTIONS.map((placement) => ({
            value: placement,
            label: metaAdPlacementLabel(placement),
          }))}
          onChange={(placement) => patchConfig({ placement: placement as MetaAdPlacement })}
        />
      </div>

      <div className={cn(BULK_HEADER_TOOL_BTN, "flex items-center gap-1 px-2")}>
        <label htmlFor="social-creator-toolbar-image" className="shrink-0 text-base text-muted-foreground">
          Image
        </label>
        <SocialCreatorDarkSelect
          id="social-creator-toolbar-image"
          value={generateConfig.includeImage === false ? "off" : "on"}
          disabled={configToolbarDisabled}
          triggerClassName="h-8 min-w-[3.25rem] shrink-0 border-0 bg-transparent pr-1 shadow-none"
          ariaLabel="Generate image creative"
          options={[
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
          ]}
          onChange={(next) => patchConfig({ includeImage: next === "on" })}
        />
      </div>

      <span className={BULK_TOOLBAR_GROUP_DIVIDER} aria-hidden />

      <WorkspacePill
        label="Defaults"
        active={defaultsOpen}
        square
        disabled={configToolbarDisabled}
        onClick={() => setDefaultsOpen(true)}
      />
      <SocialCreatorWorkspaceDefaultsDialog
        open={defaultsOpen}
        onOpenChange={setDefaultsOpen}
        generateConfig={generateConfig}
        disabled={configToolbarDisabled}
        onSave={setWorkspaceVisualDefaults}
      />

      <SocialCreatorToolbarKeywordsMenu
        disabled={configToolbarDisabled}
        onImportKeywords={handleImportKeywords}
      />

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <OverviewContentSortControls
          sortColumn={sortColumn}
          sortDir={sortDir}
          setSortColumn={setSortColumn}
          setSortDir={setSortDir}
          disabled={disabled || displayPosts.length === 0}
          titleSortLabel="Keyword"
        />
        <span className={BULK_TOOLBAR_GROUP_DIVIDER} aria-hidden />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={BULK_HEADER_ICON_TOOL_BTN}
          disabled={configToolbarDisabled}
          aria-label="Clear all posts"
          title="Clear all posts"
          onClick={handleClearAllPosts}
        >
          <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
        </Button>

        <SocialCreatorToolbarExportMenu
          disabled={disabled}
          canExportCsv={canExportSocialCreatorCsv}
          canExportZip={canExportSocialCreatorZip}
          onExportCsv={handleExportSocialCreatorCsv}
          onExportZip={handleExportSocialCreatorZip}
        />

        {isGenerating ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 w-8 shrink-0 border border-red-600/70 bg-black p-0 text-red-500 hover:bg-red-950/50"
            aria-label="Cancel"
            title="Cancel"
            onClick={handleCancelGenerate}
          >
            <Square className="h-4 w-4" aria-hidden />
          </Button>
        ) : null}

        <Button
          type="button"
          className={cn(BULK_HEADER_RUN_BTN, "shrink-0 gap-1.5")}
          disabled={configToolbarDisabled}
          onClick={() => void handleGeneratePosts()}
        >
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          Generate
        </Button>
      </div>
    </div>
  );
}
