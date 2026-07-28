import React, { useCallback, useEffect, useRef, useState } from "react";
import type { WordPressSite } from "../types";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { getUnifiedContentBankCount } from "@/lib/unified-content-bank-api";
import { PostBankBankBody, PostBankToolbar } from "./PostBankPropertyPanel";
import { SapBankBankBody, SapBankToolbar } from "./SapBankPropertyPanel";
import { usePostBankPanel } from "./use-post-bank-panel";
import { useSapBankPanel } from "./use-sap-bank-panel";
import { WP_PANEL_SECTION_SHELL } from "./wordpress-panel-chrome";

const storageKey = (siteId: string) => `flowbie-bank-panel-kind:${siteId}`;

export type BankPanelKind = "post" | "sap";

export interface BankPropertyPanelProps {
  site: WordPressSite;
}

function readStoredKind(siteId: string): BankPanelKind | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(storageKey(siteId));
    if (v === "post" || v === "sap") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export const BankPropertyPanel: React.FC<BankPropertyPanelProps> = ({ site }) => {
  const [kind, setKind] = useState<BankPanelKind>(() => readStoredKind(site.id) ?? "post");
  const [unifiedTableReady, setUnifiedTableReady] = useState<boolean | null>(null);

  const postBank = usePostBankPanel(site, kind === "post");
  const sapBank = useSapBankPanel(site, kind === "sap");

  const recheckUnifiedTable = useCallback(async () => {
    const r = await getUnifiedContentBankCount(site.id);
    setUnifiedTableReady(r.ok === true);
  }, [site.id]);

  useEffect(() => {
    void recheckUnifiedTable();
  }, [recheckUnifiedTable]);

  const prevProvisioningRef = useRef(false);
  useEffect(() => {
    const now = postBank.provisioning || sapBank.provisioning;
    if (prevProvisioningRef.current && !now) {
      void recheckUnifiedTable();
    }
    prevProvisioningRef.current = now;
  }, [postBank.provisioning, sapBank.provisioning, recheckUnifiedTable]);

  useEffect(() => {
    setKind(readStoredKind(site.id) ?? "post");
  }, [site.id]);

  const onKindChange = (value: string) => {
    if (value !== "post" && value !== "sap") return;
    setKind(value);
    try {
      window.localStorage.setItem(storageKey(site.id), value);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={cn(WP_PANEL_SECTION_SHELL, "flex min-h-0 flex-1 flex-col gap-3")}>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <ToggleGroup
          type="single"
          value={kind}
          onValueChange={(v) => {
            if (v === "post" || v === "sap") onKindChange(v);
          }}
          variant="outline"
          size="sm"
          className="shrink-0 justify-start rounded-md border border-border/50 bg-muted/50 p-0.5 shadow-none"
          aria-label="Bank type"
        >
          <ToggleGroupItem
            value="post"
            className="h-10 min-w-[7.5rem] border-0 bg-transparent px-3 text-sm font-medium text-muted-foreground shadow-none hover:bg-background/80 hover:text-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
          >
            Posts banked
          </ToggleGroupItem>
          <ToggleGroupItem
            value="sap"
            className="h-10 min-w-[7.5rem] border-0 bg-transparent px-3 text-sm font-medium text-muted-foreground shadow-none hover:bg-background/80 hover:text-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
          >
            SAP / entities
          </ToggleGroupItem>
        </ToggleGroup>
        <div className="flex min-w-0 flex-1 basis-[12rem] justify-end sm:basis-auto">
          {kind === "post" ? (
            <PostBankToolbar bank={postBank} hideCreateTableApi={unifiedTableReady === true} />
          ) : (
            <SapBankToolbar bank={sapBank} hideCreateTableApi={unifiedTableReady === true} />
          )}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {kind === "post" ? <PostBankBankBody bank={postBank} /> : <SapBankBankBody bank={sapBank} />}
      </div>
    </div>
  );
};
