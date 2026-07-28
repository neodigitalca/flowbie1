import React from "react";
import type { WordPressSite } from "../types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BankPropertyRowsGrid } from "./BankPropertyRowsGrid";
import { useSapBankPanel } from "./use-sap-bank-panel";
import { WP_PANEL_LIST_SCROLL, WP_PANEL_TOOLBAR_BTN } from "./wordpress-panel-chrome";

export interface SapBankPropertyPanelProps {
  site: WordPressSite;
}

export type SapBankPanelApi = ReturnType<typeof useSapBankPanel>;

export const SapBankToolbar: React.FC<{ bank: SapBankPanelApi; hideCreateTableApi?: boolean }> = ({
  bank,
  hideCreateTableApi = false,
}) => (
  <div className="flex flex-wrap items-center justify-end gap-1">
    {!hideCreateTableApi ? (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(WP_PANEL_TOOLBAR_BTN)}
        onClick={() => void bank.provisionTable()}
        disabled={bank.provisioning}
      >
        {bank.provisioning ? "Creating…" : "Create SAP bank table (API)"}
      </Button>
    ) : null}
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(WP_PANEL_TOOLBAR_BTN)}
      onClick={() => void bank.refresh()}
      disabled={bank.loading}
    >
      {bank.loading ? "Loading…" : "Refresh"}
    </Button>
    <Button
      type="button"
      variant="default"
      size="sm"
      className="h-10 min-h-10 shrink-0 px-3 text-base shadow-none"
      onClick={() => void bank.publish()}
      disabled={bank.publishing || bank.selected.size === 0}
    >
      {bank.publishing ? "Publishing…" : "Publish selected"}
    </Button>
  </div>
);

export const SapBankBankBody: React.FC<{ bank: SapBankPanelApi }> = ({ bank }) => (
  <div className={cn("min-h-0 flex-1", WP_PANEL_LIST_SCROLL)}>
    {bank.rows.length === 0 ? (
      <p className="px-1 py-1 text-sm text-muted-foreground">No pending rows in the SAP bank.</p>
    ) : (
      <BankPropertyRowsGrid rows={bank.rows} selected={bank.selected} onToggleId={bank.toggleId} />
    )}
  </div>
);

export const SapBankPropertyPanel: React.FC<SapBankPropertyPanelProps> = ({ site }) => {
  const bank = useSapBankPanel(site, true);
  return (
    <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 pt-2">
      <SapBankToolbar bank={bank} />
      <SapBankBankBody bank={bank} />
    </div>
  );
};
