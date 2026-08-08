import React, { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WordPressSite } from "../types";
import { fetchWordPressSitesMirror } from "../storage";
import { wordPressSiteHostKey } from "@/lib/wordpress-site-host-key";
import { SitePropertyFormFields, type SitePropertyFormFieldsProps } from "./SitePropertyFormFields";
import { WP_PANEL_SECTION_SHELL } from "./wordpress-panel-chrome";

export type SitePropertyEditPanelProps = SitePropertyFormFieldsProps & {
  /** Row context (saved site); form state should match this while editing. */
  site: WordPressSite;
  editingSite: WordPressSite | null;
  onSave: () => void;
};

function findServerRow(site: WordPressSite, rows: WordPressSite[]): WordPressSite | undefined {
  const byId = rows.find((row) => row.id === site.id);
  if (byId) return byId;
  const host = wordPressSiteHostKey(site.siteUrl);
  if (!host) return undefined;
  return rows.find((row) => wordPressSiteHostKey(row.siteUrl) === host);
}

export const SitePropertyEditPanel: React.FC<SitePropertyEditPanelProps> = ({
  site,
  editingSite,
  onSave,
  formGbpLocationId,
  formGa4PropertyId,
  onFormGbpLocationIdChange,
  onFormGa4PropertyIdChange,
  onPatchSite,
  ...formProps
}) => {
  const formReady = editingSite?.id === site.id;
  const hydrateKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!formReady) {
      hydrateKeyRef.current = null;
      return;
    }
    if (hydrateKeyRef.current === site.id) return;

    let cancelled = false;
    void (async () => {
      const rows = await fetchWordPressSitesMirror();
      if (cancelled) return;
      hydrateKeyRef.current = site.id;
      if (rows.length === 0) return;

      const row = findServerRow(site, rows);
      if (!row) return;

      const gbp = row.gbpLocationId?.trim() ?? "";
      const ga4 = row.ga4PropertyId?.trim() ?? "";

      if (gbp) {
        onPatchSite?.(site.id, { gbpLocationId: gbp });
        if (formGbpLocationId.trim() !== gbp) {
          onFormGbpLocationIdChange(gbp);
        }
      }
      if (ga4) {
        onPatchSite?.(site.id, { ga4PropertyId: ga4 });
        if (formGa4PropertyId.trim() !== ga4) {
          onFormGa4PropertyIdChange(ga4);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    formReady,
    site,
    formGbpLocationId,
    formGa4PropertyId,
    onFormGbpLocationIdChange,
    onFormGa4PropertyIdChange,
    onPatchSite,
  ]);

  const persistedGbp = site.gbpLocationId?.trim() || "";
  const persistedGa4 = site.ga4PropertyId?.trim() || "";

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
          <SitePropertyFormFields
            {...formProps}
            formGbpLocationId={formGbpLocationId}
            formGa4PropertyId={formGa4PropertyId}
            onFormGbpLocationIdChange={onFormGbpLocationIdChange}
            onFormGa4PropertyIdChange={onFormGa4PropertyIdChange}
            onPatchSite={onPatchSite}
            persistedGbpLocationId={persistedGbp}
            persistedGa4PropertyId={persistedGa4}
            chrome="light"
            className="py-0"
          />
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
