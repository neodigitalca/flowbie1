import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WordPressSite } from "../types";
import { SitePropertyFormFields, type SitePropertyFormFieldsProps } from "./SitePropertyFormFields";
import { WP_PANEL_SECTION_SHELL } from "./wordpress-panel-chrome";

export type SitePropertyEditPanelProps = SitePropertyFormFieldsProps & {
  /** Row context (saved site); form state should match this while editing. */
  site: WordPressSite;
  editingSite: WordPressSite | null;
  onSave: () => void;
};

export const SitePropertyEditPanel: React.FC<SitePropertyEditPanelProps> = ({
  site,
  editingSite,
  onSave,
  ...formProps
}) => {
  const formReady = editingSite?.id === site.id;

  return (
    <div
      className={cn(
        WP_PANEL_SECTION_SHELL,
        "flex w-full min-w-0 shrink-0 flex-col gap-3",
      )}
    >
      {!formReady ? (
        <p className="shrink-0 text-sm text-muted-foreground">Loading form…</p>
      ) : (
        <div className="flex shrink-0 flex-col gap-3">
          <SitePropertyFormFields {...formProps} chrome="light" className="py-0" />
          <div className="shrink-0 border-t border-border/60 pt-3">
            <Button
              type="button"
              variant="default"
              onClick={onSave}
              className="h-10 min-h-10 px-4 text-base font-semibold shadow-none"
            >
              Save Property
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
