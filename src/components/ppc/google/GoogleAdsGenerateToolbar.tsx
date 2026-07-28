import { ChevronDown, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BULK_HEADER_RUN_BTN,
  BULK_HEADER_TOOL_BTN,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import {
  clampPpcAdGroupCount,
  clampPpcAdsPerAdGroup,
  clampPpcCampaignCount,
  PPC_AD_GROUP_COUNT_MAX,
  PPC_AD_GROUP_COUNT_MIN,
  PPC_ADS_PER_GROUP_MAX,
  PPC_ADS_PER_GROUP_MIN,
  PPC_CAMPAIGN_COUNT_MAX,
  PPC_CAMPAIGN_COUNT_MIN,
  type PpcGenerateConfig,
} from "@/lib/ppc/google-ads-types";
import type { PpcGoogleWorkspaceController } from "@/hooks/ppc/use-ppc-google-workspace";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export type GoogleAdsGenerateToolbarProps = {
  ctrl: PpcGoogleWorkspaceController;
  disabled?: boolean;
};

const PPC_TOOLBAR_NESTED_SHELL = cn(
  "flex h-8 shrink-0 items-center gap-1 rounded-none bg-zinc-900 px-1.5 py-0 focus-within:ring-0",
);

const PPC_TOOLBAR_NESTED_LABEL = "shrink-0 text-base text-muted-foreground";

function PpcToolbarNestedField({
  label,
  inputId,
  children,
  wide,
  numeric,
}: {
  label: string;
  inputId: string;
  children: ReactNode;
  wide?: boolean;
  numeric?: boolean;
}) {
  return (
    <div className={PPC_TOOLBAR_NESTED_SHELL}>
      <label htmlFor={inputId} className={PPC_TOOLBAR_NESTED_LABEL}>
        {label}
      </label>
      <div
        className={cn(
          "flex shrink-0 items-center",
          numeric && "min-w-[3.75rem]",
          wide && "min-w-[4.5rem]",
        )}
      >
        {children}
      </div>
    </div>
  );
}

const PPC_TOOLBAR_NUM_INPUT =
  "h-8 w-[3.75rem] min-w-[3.75rem] shrink-0 border-0 bg-transparent pl-0.5 pr-3 text-right text-base tabular-nums text-foreground shadow-none focus-visible:outline-none focus-visible:ring-0";

export function GoogleAdsGenerateToolbar({ ctrl, disabled = false }: GoogleAdsGenerateToolbarProps) {
  const {
    generateConfig,
    setGenerateConfig,
    handleGenerateCampaign,
    handleExportGoogleAdsCsv,
    canExportGoogleAdsCsv,
    isGenerating,
  } = ctrl;
  const toolbarDisabled = disabled || isGenerating;

  const patchConfig = (patch: Partial<PpcGenerateConfig>) => {
    setGenerateConfig((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto">
      <PpcToolbarNestedField label="Campaigns" inputId="ppc-toolbar-campaigns" numeric>
        <input
          id="ppc-toolbar-campaigns"
          type="number"
          min={PPC_CAMPAIGN_COUNT_MIN}
          max={PPC_CAMPAIGN_COUNT_MAX}
          value={generateConfig.campaignCount}
          disabled={toolbarDisabled}
          className={PPC_TOOLBAR_NUM_INPUT}
          aria-label="Campaigns to generate"
          onChange={(e) =>
            patchConfig({
              campaignCount: clampPpcCampaignCount(Number(e.target.value) || PPC_CAMPAIGN_COUNT_MIN),
            })
          }
        />
      </PpcToolbarNestedField>

      <PpcToolbarNestedField label="Ad groups" inputId="ppc-toolbar-ad-groups" numeric>
        <input
          id="ppc-toolbar-ad-groups"
          type="number"
          min={PPC_AD_GROUP_COUNT_MIN}
          max={PPC_AD_GROUP_COUNT_MAX}
          value={generateConfig.adGroupCount}
          disabled={toolbarDisabled}
          className={PPC_TOOLBAR_NUM_INPUT}
          aria-label="Ad groups"
          onChange={(e) =>
            patchConfig({
              adGroupCount: clampPpcAdGroupCount(Number(e.target.value) || PPC_AD_GROUP_COUNT_MIN),
            })
          }
        />
      </PpcToolbarNestedField>

      <PpcToolbarNestedField label="Ads" inputId="ppc-toolbar-ads" numeric>
        <input
          id="ppc-toolbar-ads"
          type="number"
          min={PPC_ADS_PER_GROUP_MIN}
          max={PPC_ADS_PER_GROUP_MAX}
          value={generateConfig.adsPerAdGroup}
          disabled={toolbarDisabled}
          className={PPC_TOOLBAR_NUM_INPUT}
          aria-label="Ads"
          onChange={(e) =>
            patchConfig({
              adsPerAdGroup: clampPpcAdsPerAdGroup(Number(e.target.value) || PPC_ADS_PER_GROUP_MIN),
            })
          }
        />
      </PpcToolbarNestedField>

      <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-1.5">
        <Button
          type="button"
          disabled={toolbarDisabled}
          className={cn(BULK_HEADER_RUN_BTN, "shrink-0 gap-1.5")}
          onClick={() => void handleGenerateCampaign()}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          Generate
        </Button>

        <Button
          type="button"
          variant="ghost"
          disabled={toolbarDisabled || !canExportGoogleAdsCsv}
          className={cn(BULK_HEADER_TOOL_BTN, "shrink-0 gap-1.5")}
          onClick={handleExportGoogleAdsCsv}
        >
          <Download className="h-4 w-4" aria-hidden />
          CSV
        </Button>
      </div>
    </div>
  );
}
