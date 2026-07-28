/**
 * Shared title/keyword/modifier/featured-image fields for SAP CSV rows (SAP tab + CSV dialog).
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_FAILED_TO_COPY, notifyCopiedX } from "@/lib/notify-messages";
import { Loader2, Bot } from "lucide-react";
import { generateAITitleSuggestion } from "@/components/integrations/entity-generation/csv/titleSuggestion";
import { replaceTemplateVariables } from "@/components/integrations/entity-generation/csv/csvGenerator";
import { CYBERPUNK_CLASSES } from "@/components/integrations/wordpress/cyberpunk-theme";
import type { WordPressSite } from "@/components/integrations/types";

export type SapTemplateFieldsVariant = "default" | "cyberpunk";

export interface SapTemplateFieldsProps {
  variant?: SapTemplateFieldsVariant;
  pendingEntitySite: WordPressSite | null;
  entities: string[];
  titleFormat: string;
  onTitleFormatChange: (v: string) => void;
  keyword: string;
  onKeywordChange: (v: string) => void;
  modifier: string;
  onModifierChange: (v: string) => void;
  /** Optional: show table preview (SAP page uses bulk list instead) */
  showPreviewTable?: boolean;
}

export const SapTemplateFields: React.FC<SapTemplateFieldsProps> = ({
  variant = "default",
  pendingEntitySite,
  entities,
  titleFormat,
  onTitleFormatChange,
  keyword,
  onKeywordChange,
  modifier,
  onModifierChange,
  showPreviewTable = true,
}) => {
  const [isGeneratingTitleSuggestion, setIsGeneratingTitleSuggestion] = useState(false);
  const cyber = variant === "cyberpunk";
  const inputClass = cyber
    ? "bg-[#050505] border-green-500/30 text-foreground font-mono"
    : "bg-input border-border text-foreground";
  const labelClass = cyber ? "font-mono text-foreground" : "";

  const totalEntities = entities?.length ?? 0;
  const handleGenerateAITitleSuggestion = async () => {
    if (!pendingEntitySite || !entities || entities.length === 0) return;
    setIsGeneratingTitleSuggestion(true);
    try {
      const suggestion = await generateAITitleSuggestion(entities, pendingEntitySite);
      if (suggestion) onTitleFormatChange(suggestion);
    } finally {
      setIsGeneratingTitleSuggestion(false);
    }
  };

  const previewCount = Math.min(10, totalEntities);
  const previewRowsLabel =
    totalEntities <= 10
      ? `Showing rows 1–${totalEntities} of ${totalEntities}`
      : `Showing rows 1–${previewCount} of ${totalEntities}`;
  const previewSectionLabel =
    totalEntities <= 10
      ? `Preview: first ${totalEntities} of ${totalEntities} entities`
      : `Preview: first ${previewCount} of ${totalEntities} entities`;

  return (
    <div className="space-y-4">
      {totalEntities > 0 && (
        <div
          className={
            cyber
              ? `rounded-md border ${CYBERPUNK_CLASSES.borderDivider} ${CYBERPUNK_CLASSES.bgNeon} p-3`
              : "rounded-md border border-border bg-muted/30 p-3"
          }
        >
          <div
            className={
              cyber
                ? "text-xs font-mono uppercase tracking-wider text-green-400/80 mb-2"
                : "text-xs font-semibold text-foreground mb-2"
            }
          >
            Summary
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-foreground">
            <span className={cyber ? "text-green-400/90" : "text-muted-foreground"}>Total entities:</span>
            <span>{totalEntities}</span>
            <span className={cyber ? "text-green-400/90" : "text-muted-foreground"}>Featured image:</span>
            <span>Google Image only (no AI images)</span>
            <span className={cyber ? "text-green-400/90" : "text-muted-foreground"}>Keyword:</span>
            <span>{keyword.trim() ? "Set" : "Not set"}</span>
            <span className={cyber ? "text-green-400/90" : "text-muted-foreground"}>Modifier:</span>
            <span>{modifier.trim() ? "Set" : "Not set"}</span>
          </div>
        </div>
      )}

      <div className={cyber ? "border-t border-green-500/20 pt-4" : "space-y-4"}>
        {cyber && (
          <div className="text-xs font-mono uppercase tracking-wider text-green-400/80 mb-3">Configuration</div>
        )}
        <div className="space-y-4">
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="sap-csvTitleFormat" className={labelClass}>
                Title Format
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleGenerateAITitleSuggestion}
                disabled={isGeneratingTitleSuggestion || totalEntities === 0}
                className={
                  cyber
                    ? "h-7 px-2 text-xs border border-green-500/30 text-green-400 hover:bg-green-500/20"
                    : "h-7 px-2 text-xs"
                }
                title="AI Suggest Title Template"
              >
                {isGeneratingTitleSuggestion ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Bot className="h-3 w-3 mr-1" />
                    AI Suggest
                  </>
                )}
              </Button>
            </div>
            <Input
              id="sap-csvTitleFormat"
              value={titleFormat}
              onChange={(e) => onTitleFormatChange(e.target.value)}
              placeholder="e.g., {keyword} Near {entity}"
              className={inputClass}
            />
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">Use variables:</span>
              {["{entity}", "{keyword}"].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    navigator.clipboard
                      .writeText(value)
                      .then(() => notify.success(notifyCopiedX(value)))
                      .catch(() => notify.error(NOTIFY_FAILED_TO_COPY));
                  }}
                  className={
                    cyber
                      ? "text-xs bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 px-1.5 py-0.5 rounded font-mono text-green-300"
                      : "text-xs underline text-[hsl(var(--semantic-data-foreground))]"
                  }
                >
                  {value}
                </button>
              ))}
            </div>
            {titleFormat && entities[0] && (
              <div
                className={
                  cyber
                    ? "mt-2 p-2 bg-green-500/10 rounded border border-green-500/20"
                    : "mt-2 p-2 rounded border border-border bg-muted/40"
                }
              >
                <p className="text-xs text-muted-foreground mb-1">Preview (first entity):</p>
                <p className={cyber ? "text-sm font-mono text-green-300" : "text-sm"}>
                  {replaceTemplateVariables(titleFormat, entities[0], keyword || "keyword")}
                </p>
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sap-csvKeyword" className={labelClass}>
              Keyword (optional)
            </Label>
            <Input
              id="sap-csvKeyword"
              value={keyword}
              onChange={(e) => onKeywordChange(e.target.value)}
              placeholder="Leave empty to use a default in bulk rows"
              className={inputClass}
            />
          </div>

          <div className="grid gap-2">
            <Label className={labelClass}>Featured image</Label>
            <p
              className={
                cyber
                  ? "text-sm font-mono text-green-300/90 rounded-md border border-green-500/30 bg-green-500/5 px-3 py-2"
                  : "text-sm text-muted-foreground rounded-md border border-border bg-muted/30 px-3 py-2"
              }
            >
              Bulk posts use the Google Maps snapshot image for each service area. AI-generated featured images are not
              used in the SAP generator.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="sap-csvModifier" className={labelClass}>
              Modifier (optional)
            </Label>
            <Input
              id="sap-csvModifier"
              value={modifier}
              onChange={(e) => onModifierChange(e.target.value)}
              placeholder="e.g., Focus on high-income neighborhoods"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {showPreviewTable && totalEntities > 0 && (
        <div className={cyber ? "border-t border-green-500/20 pt-4" : "border-t pt-4"}>
          <div
            className={
              cyber
                ? "text-xs font-mono uppercase tracking-wider text-green-400/80 mb-2"
                : "text-xs font-semibold mb-2"
            }
          >
            {previewSectionLabel}
          </div>
          <div className="text-xs text-muted-foreground mb-2">{previewRowsLabel}</div>
          <div
            className={
              cyber
                ? "max-h-64 overflow-y-auto border border-green-500/30 rounded-md bg-[#050505]"
                : "max-h-64 overflow-y-auto border border-border rounded-md bg-background"
            }
          >
            <div
              className={
                cyber
                  ? "grid grid-cols-[1fr_2fr_100px] gap-2 px-3 py-2 bg-green-500/10 border-b border-green-500/30 text-sm font-mono uppercase tracking-wider text-green-400/80 sticky top-0 z-10"
                  : "grid grid-cols-[1fr_2fr_100px] gap-2 px-3 py-2 bg-muted/50 border-b text-sm font-medium sticky top-0 z-10"
              }
            >
              <div>Entity</div>
              <div>Title</div>
              <div>Featured</div>
            </div>
            <div className={cyber ? "divide-y divide-green-500/10" : "divide-y divide-border"}>
              {entities.slice(0, 10).map((entity, index) => {
                const previewTitle = titleFormat
                  ? replaceTemplateVariables(titleFormat, entity, keyword || "")
                  : entity;
                return (
                  <div key={index} className="grid grid-cols-[1fr_2fr_100px] gap-2 px-3 py-2 text-xs text-foreground">
                    <div className={cyber ? "truncate text-green-300/90" : "truncate"}>{entity}</div>
                    <div className="truncate">{previewTitle}</div>
                    <div className="text-muted-foreground">Google</div>
                  </div>
                );
              })}
            </div>
            {entities.length > 10 && (
              <div className="text-xs text-muted-foreground mt-2 pt-2 px-3 pb-2 border-t">
                … and {entities.length - 10} more entities (Total: {totalEntities})
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
