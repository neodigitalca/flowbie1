import React from "react";
import type { WordPressSite } from "../types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BankPropertyRowsGrid } from "./BankPropertyRowsGrid";
import { usePostBankPanel } from "./use-post-bank-panel";
import { WP_PANEL_LIST_SCROLL, WP_PANEL_TOOLBAR_BTN } from "./wordpress-panel-chrome";

export interface PostBankPropertyPanelProps {
  site: WordPressSite;
}

export type PostBankPanelApi = ReturnType<typeof usePostBankPanel>;

export const PostBankToolbar: React.FC<{ bank: PostBankPanelApi; hideCreateTableApi?: boolean }> = ({
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
        {bank.provisioning ? "Creating…" : "Create bank table (API)"}
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

export const PostBankBankBody: React.FC<{ bank: PostBankPanelApi }> = ({ bank }) => (
  <div className={cn("min-h-0 flex-1", WP_PANEL_LIST_SCROLL)}>
    {bank.rows.length === 0 ? (
      <p className="px-1 py-1 text-sm text-muted-foreground">No pending rows in the bank.</p>
    ) : (
      <BankPropertyRowsGrid rows={bank.rows} selected={bank.selected} onToggleId={bank.toggleId} />
    )}
  </div>
);

export const PostBankPropertyPanel: React.FC<PostBankPropertyPanelProps> = ({ site }) => {
  const bank = usePostBankPanel(site, true);
  return (
    <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2 pt-2">
      <PostBankToolbar bank={bank} />
      <PostBankBankBody bank={bank} />
    </div>
  );
};
