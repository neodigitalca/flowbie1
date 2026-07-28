import React, { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { notify } from "@/lib/app-notifications";
import type { WordPressSite } from "../types";
import { buildUnifiedContentBankProvisioningSqlBlock } from "@/lib/unified-content-bank-api";
import { WP_PANEL_TOOLBAR_BTN } from "./wordpress-panel-chrome";

export interface ContentBankSupabaseTabPanelProps {
  site: WordPressSite;
}

export const ContentBankSupabaseTabPanel: React.FC<ContentBankSupabaseTabPanelProps> = ({ site }) => {
  const handleCopySql = useCallback(async () => {
    const label = site.name?.trim() || site.id;
    const sql = buildUnifiedContentBankProvisioningSqlBlock(site.id, label);
    try {
      await navigator.clipboard.writeText(sql);
      notify.success(NOTIFY_COPIED);
    } catch {
      notify.error(NOTIFY_CLIPBOARD_UNAVAILABLE);
    }
  }, [site.id, site.name]);

  return (
    <div className="flex min-h-0 flex-1 flex-col pt-2">
      <Button type="button" variant="ghost" size="default" className={WP_PANEL_TOOLBAR_BTN} onClick={() => void handleCopySql()}>
        <Copy className="h-4 w-4 shrink-0" aria-hidden />
        Copy SQL
      </Button>
    </div>
  );
};
