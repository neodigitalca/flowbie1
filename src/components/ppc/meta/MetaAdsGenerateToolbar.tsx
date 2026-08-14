import { Sparkles, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BULK_HEADER_ICON_TOOL_BTN,
  BULK_HEADER_RUN_BTN,
  BULK_TOOLBAR_GROUP_DIVIDER,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import { MetaAdsDarkSelect } from "@/components/ppc/meta/MetaAdsDarkSelect";
import { MetaAdsToolbarExportMenu } from "@/components/ppc/meta/MetaAdsToolbarExportMenu";
import { MetaAdsToolbarKeywordsMenu } from "@/components/ppc/meta/MetaAdsToolbarKeywordsMenu";
import {
  clampMetaAdCount,
  META_AD_COUNT_MAX,
  META_AD_COUNT_MIN,
  type MetaAdPlacement,
  type MetaGenerateConfig,
} from "@/lib/ppc/meta-ads-types";
import { metaAdPlacementLabel } from "@/lib/ppc/meta-ads-field-limits";
import type { PpcMetaWorkspaceController } from "@/hooks/ppc/use-ppc-meta-workspace";
import { cn } from "@/lib/utils";

export type MetaAdsGenerateToolbarProps = {
  ctrl: PpcMetaWorkspaceController;
  disabled?: boolean;
};

const PPC_TOOLBAR_NESTED_SHELL = cn(
  "flex h-8 shrink-0 items-center gap-1 rounded-none bg-zinc-900 px-1.5 py-0 focus-within:ring-0",
);

const PPC_TOOLBAR_NESTED_LABEL = "shrink-0 text-base text-muted-foreground";

const PPC_TOOLBAR_NUM_INPUT =
  "h-8 w-[3.75rem] min-w-[3.75rem] shrink-0 border-0 bg-transparent pl-0.5 pr-3 text-right text-base tabular-nums text-foreground shadow-none focus-visible:outline-none focus-visible:ring-0";

const PLACEMENT_OPTIONS: MetaAdPlacement[] = ["feed_1x1", "feed_4x5", "story_9x16"];

export function MetaAdsGenerateToolbar({ ctrl, disabled = false }: MetaAdsGenerateToolbarProps) {
  const {
    generateConfig,
    setGenerateConfig,
    handleGenerateAds,
    handleCancelGenerate,
    handleImportKeywords,
    handleClearAllAds,
    handleExportMetaAdsCsv,
    canExportMetaAdsCsv,
    handleExportMetaAdsCreativeZip,
    canExportMetaAdsCreativeZip,
    isGenerating,
  } = ctrl;
  const configToolbarDisabled = disabled || isGenerating;

  const patchConfig = (patch: Partial<MetaGenerateConfig>) => {
    setGenerateConfig((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
      <div className={PPC_TOOLBAR_NESTED_SHELL}>
        <label htmlFor="ppc-meta-toolbar-ads" className={PPC_TOOLBAR_NESTED_LABEL}>
          Ads
        </label>
        <input
          id="ppc-meta-toolbar-ads"
          type="number"
          min={META_AD_COUNT_MIN}
          max={META_AD_COUNT_MAX}
          value={generateConfig.adCount}
          disabled={configToolbarDisabled}
          className={PPC_TOOLBAR_NUM_INPUT}
          aria-label="Ads to generate"
          onChange={(e) =>
            patchConfig({
              adCount: clampMetaAdCount(Number(e.target.value) || META_AD_COUNT_MIN),
            })
          }
        />
      </div>

      <div className={PPC_TOOLBAR_NESTED_SHELL}>
        <label htmlFor="ppc-meta-toolbar-format" className={PPC_TOOLBAR_NESTED_LABEL}>
          Format
        </label>
        <MetaAdsDarkSelect
          id="ppc-meta-toolbar-format"
          value={generateConfig.placement}
          disabled={configToolbarDisabled}
          triggerClassName="h-8 min-w-[6.5rem] shrink-0 pr-1"
          ariaLabel="Ad placement format"
          options={PLACEMENT_OPTIONS.map((placement) => ({
            value: placement,
            label: metaAdPlacementLabel(placement),
          }))}
          onChange={(placement) => patchConfig({ placement: placement as MetaAdPlacement })}
        />
      </div>

      <div className={PPC_TOOLBAR_NESTED_SHELL}>
        <label htmlFor="ppc-meta-toolbar-image" className={PPC_TOOLBAR_NESTED_LABEL}>
          Image
        </label>
        <MetaAdsDarkSelect
          id="ppc-meta-toolbar-image"
          value={generateConfig.includeImage === false ? "off" : "on"}
          disabled={configToolbarDisabled}
          triggerClassName="h-8 min-w-[3.25rem] shrink-0 pr-1"
          ariaLabel="Generate image creative"
          options={[
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
          ]}
          onChange={(next) => patchConfig({ includeImage: next === "on" })}
        />
      </div>

      <span className={BULK_TOOLBAR_GROUP_DIVIDER} aria-hidden />

      <MetaAdsToolbarKeywordsMenu
        disabled={configToolbarDisabled}
        onImportKeywords={handleImportKeywords}
      />

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={BULK_HEADER_ICON_TOOL_BTN}
          disabled={configToolbarDisabled}
          aria-label="Clear all ads"
          title="Clear all ads"
          onClick={handleClearAllAds}
        >
          <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
        </Button>

        <MetaAdsToolbarExportMenu
          disabled={disabled}
          canExportCsv={canExportMetaAdsCsv}
          canExportZip={canExportMetaAdsCreativeZip}
          onExportCsv={handleExportMetaAdsCsv}
          onExportZip={handleExportMetaAdsCreativeZip}
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
          onClick={() => void handleGenerateAds()}
        >
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          Generate
        </Button>
      </div>
    </div>
  );
}
