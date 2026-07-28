import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CONTENT_OPTIMIZER_MULTI_SITE_OPTIMIZE_ROW_BTN } from "@/components/overview/overview-tab/overview-tab-content-constants";

export type GoogleAdsCampaignRowGenerateButtonProps = {
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export function GoogleAdsCampaignRowGenerateButton({
  busy = false,
  disabled = false,
  onClick,
}: GoogleAdsCampaignRowGenerateButtonProps) {
  return (
    <Button
      type="button"
      size="icon"
      disabled={disabled || busy}
      className={CONTENT_OPTIMIZER_MULTI_SITE_OPTIMIZE_ROW_BTN}
      aria-label={busy ? "Generating campaign" : "Generate campaign"}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary-foreground sm:h-4 sm:w-4" aria-hidden />
      ) : (
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary-foreground sm:h-4 sm:w-4" aria-hidden />
      )}
    </Button>
  );
}
