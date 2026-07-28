import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { BULK_HEADER_TOOL_BTN } from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import type { ImageChecklistItem } from "@/lib/image-checklist-builder";

type ImageGeneratorChecklistPanelProps = {
  hasGeneratedChecklist: boolean;
  imageChecklist: ImageChecklistItem[];
  isGeneratingChecklist: boolean;
  hasApiKey: boolean;
  onRegenerateChecklist: () => void;
};

export function ImageGeneratorChecklistPanel({
  hasGeneratedChecklist,
  imageChecklist,
  isGeneratingChecklist,
  hasApiKey,
  onRegenerateChecklist,
}: ImageGeneratorChecklistPanelProps) {
  if (!hasGeneratedChecklist || imageChecklist.length === 0) return null;

  return (
    <div className="space-y-4 bg-zinc-900/50 p-4">
      <Label className="text-base font-semibold text-foreground">Image Generation Checklist</Label>
      <div className="space-y-4">
        {imageChecklist.map((item, index) => (
          <div key={index} className="space-y-1 pb-3 last:pb-0">
            <h4 className="text-base font-semibold leading-tight text-foreground">{item.title}</h4>
            <p className="pl-2 text-base leading-relaxed text-muted-foreground">{item.description}</p>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={BULK_HEADER_TOOL_BTN}
        onClick={onRegenerateChecklist}
        disabled={isGeneratingChecklist || !hasApiKey}
      >
        {isGeneratingChecklist ? (
          <>
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            Regenerating
          </>
        ) : (
          "Regenerate checklist"
        )}
      </Button>
    </div>
  );
}
