import React, { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { notify } from "@/lib/app-notifications";
import {
  NOTIFY_CLIPBOARD_UNAVAILABLE,
  NOTIFY_COPIED,
  NOTIFY_SAVE_THE_PROPERTY_FIRST_SO_IT_HAS_A_STAB,
  NOTIFY_SAVE_THE_PROPERTY_FIRST_SO_IT_HAS_A_STAB_2,
  NOTIFY_SET_SITE_URL_WORDPRESS_REST_FIRST_THEN_T,
  NOTIFY_SITE_ID_COPIED,
  notifyMatchedSemrushProjectXXX,
} from "@/lib/notify-messages";
import type { WordPressSite } from "../types";
import { matchSemrushProjectForSite } from "@/lib/wordpress-api/semrush";
import { isOptimizationPackageTier } from "@/lib/wordpress-optimization-package";
import { buildUnifiedContentBankProvisioningSqlBlock } from "@/lib/unified-content-bank-api";
import { persistGbpLocationIdInput } from "@/lib/gbp-post/normalize-gbp-location-id";
import {
  WP_PANEL_INSET_BAND,
  WP_PANEL_LIST_GAP,
  WP_PANEL_ROW_TILE,
  WP_PANEL_TOOLBAR_BTN,
} from "./wordpress-panel-chrome";
import {
  TASK_FORM_FLAT_CONTROL_CLASS,
  TaskFormFlatGrid,
  TaskFormPlaceholderCell,
  TaskFormSideSection,
} from "@/components/manager/tasks/TaskFormLayout";
import {
  PROPERTY_SETTINGS_SUB_SECTIONS,
  type PropertySettingsSubSectionId,
} from "./property-settings-types";

export type SitePropertyFormChrome = "dark" | "light";

/** Lato + 1rem floor; copy wraps instead of truncating. */
const SITE_PROPERTY_COPY = "font-sans text-base leading-normal whitespace-normal break-words";

function fieldClassName(chrome: SitePropertyFormChrome): string {
  return cn(
    SITE_PROPERTY_COPY,
    "min-h-10 rounded-none border-0 bg-black shadow-none focus-visible:ring-2 focus-visible:ring-offset-0",
    chrome === "dark"
      ? "h-9 min-h-9 text-white placeholder:text-white/55 focus-visible:ring-white/35 focus-visible:ring-offset-black"
      : "h-10 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/55 focus-visible:ring-offset-background",
  );
}

function SitePropertyInput({
  chrome,
  className,
  ...props
}: React.ComponentProps<typeof Input> & { chrome: SitePropertyFormChrome }) {
  return (
    <Input variant="neoPulseBlack" className={cn(fieldClassName(chrome), className)} {...props} />
  );
}

function stackedLabelClass(chrome: SitePropertyFormChrome): string {
  return cn(SITE_PROPERTY_COPY, "font-medium", chrome === "dark" ? "text-white" : "text-foreground");
}

function fieldsGridClass(chrome: SitePropertyFormChrome): string {
  if (chrome === "light") {
    return "grid grid-cols-1 gap-x-4 gap-y-0 sm:grid-cols-2";
  }
  return "flex flex-col";
}

function helpClass(chrome: SitePropertyFormChrome): string {
  return cn(SITE_PROPERTY_COPY, chrome === "dark" ? "text-white" : "text-muted-foreground");
}

function strongHelpClass(chrome: SitePropertyFormChrome): string {
  return chrome === "dark" ? "font-semibold text-white" : "font-semibold text-foreground";
}

function inlineCodeClass(chrome: SitePropertyFormChrome): string {
  return cn(
    SITE_PROPERTY_COPY,
    "rounded-md px-1.5 py-0.5 font-mono font-medium",
    chrome === "dark" ? "bg-white/12 text-white/95" : "bg-background text-foreground ring-1 ring-border/60",
  );
}

function supabaseStepRowClass(chrome: SitePropertyFormChrome): string {
  return cn(
    "flex gap-3 rounded-lg border px-3 py-2.5 sm:gap-3.5 sm:px-3.5 sm:py-3",
    chrome === "dark" ? "border-white/10 bg-black/25" : "border-border/50 bg-background/80",
  );
}

function supabaseStepBadgeClass(chrome: SitePropertyFormChrome): string {
  return cn(
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-sans text-base font-semibold tabular-nums",
    chrome === "dark" ? "bg-white/12 text-white" : "bg-muted text-foreground ring-1 ring-border/50",
  );
}

function accordionItemBorder(chrome: SitePropertyFormChrome): string {
  return cn("border-b", chrome === "dark" ? "border-white/10" : "border-border");
}

/** Sitemap-style inset tiles when using theme (light) chrome. */
function accordionItemClass(chrome: SitePropertyFormChrome): string {
  if (chrome === "light") {
    return cn(WP_PANEL_ROW_TILE, "border-b-0 !border-b-0 p-0 shadow-none");
  }
  return accordionItemBorder(chrome);
}

function accordionTriggerClass(chrome: SitePropertyFormChrome): string {
  if (chrome === "dark") {
    return cn(
      "min-h-10 items-center py-1.5 text-left hover:no-underline [&[data-state=open]>svg]:text-current text-white",
      SITE_PROPERTY_COPY,
    );
  }
  return cn(
    "min-h-10 items-center px-3 py-2 text-left font-medium text-foreground hover:no-underline [&[data-state=open]>svg]:text-foreground",
    SITE_PROPERTY_COPY,
  );
}

function accordionContentClass(chrome: SitePropertyFormChrome): string {
  return cn(
    "!text-base",
    chrome === "light" ? "[&>div]:px-3 [&>div]:pt-0 [&>div]:!pb-3" : "pb-2 pt-0",
  );
}

function radioOptionLabelClass(chrome: SitePropertyFormChrome): string {
  return cn("cursor-pointer font-normal", SITE_PROPERTY_COPY, chrome === "dark" ? "text-white" : "text-foreground");
}

/** Stacked label + field; optional help spans full tile width below. */
function FieldBlock({
  label,
  htmlFor,
  field,
  help,
  chrome,
  span = "default",
}: {
  label: string;
  htmlFor: string;
  field: React.ReactNode;
  help?: React.ReactNode;
  chrome: SitePropertyFormChrome;
  /** `full` spans both grid columns in light (modal) chrome. */
  span?: "default" | "full";
}) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-1 py-1.5",
        span === "full" && chrome === "light" && "sm:col-span-2",
      )}
    >
      <Label htmlFor={htmlFor} className={stackedLabelClass(chrome)}>
        {label}
      </Label>
      {field}
      {help ? <div className="w-full">{help}</div> : null}
    </div>
  );
}

export interface SitePropertyFormFieldsProps {
  /** Dark sheet (embedded site settings) vs light card (modal). */
  chrome?: SitePropertyFormChrome;
  formName: string;
  formSiteUrl: string;
  formProductionSiteUrl: string;
  formUsername: string;
  formAppPassword: string;
  formGa4PropertyId: string;
  formGbpLocationId: string;
  formSemrushSiteAuditProjectId: string;
  /** Saved on site row / server mirror when form state is still empty. */
  persistedGbpLocationId?: string;
  persistedGa4PropertyId?: string;
  formEditorialCountsPeriodStartYmd: string;
  /** Empty string = no package (unlimited). */
  formOptimizationPackage: string;
  formBenchmarkCustomTag: string;
  onFormNameChange: (value: string) => void;
  onFormSiteUrlChange: (value: string) => void;
  onFormProductionSiteUrlChange: (value: string) => void;
  onFormUsernameChange: (value: string) => void;
  onFormAppPasswordChange: (value: string) => void;
  onFormGa4PropertyIdChange: (value: string) => void;
  onFormGbpLocationIdChange: (value: string) => void;
  onFormSemrushSiteAuditProjectIdChange: (value: string) => void;
  onFormEditorialCountsPeriodStartYmdChange: (value: string) => void;
  onFormOptimizationPackageChange: (value: string) => void;
  onFormBenchmarkCustomTagChange: (value: string) => void;
  /**
   * When set with `patchSiteId`, "Match project from Semrush" / "Save project ID now" persist immediately
   * (embedded Site Settings or edit dialog). Otherwise Match only fills the field until you save the property.
   */
  onPatchSite?: (siteId: string, patch: Partial<WordPressSite>) => void;
  patchSiteId?: string | null;
  /** When true, Semrush buttons are disabled (e.g. property toggled off). */
  semrushActionsDisabled?: boolean;
  /** Extra classes on the root form element (e.g. compact vs dialog spacing). */
  className?: string;
  layout?: "accordion" | "modalFlat";
  settingsSubSectionId?: PropertySettingsSubSectionId;
}

export const SitePropertyFormFields: React.FC<SitePropertyFormFieldsProps> = ({
  chrome = "dark",
  formName,
  formSiteUrl,
  formProductionSiteUrl,
  formUsername,
  formAppPassword,
  formGa4PropertyId,
  formGbpLocationId,
  persistedGbpLocationId = "",
  persistedGa4PropertyId = "",
  formSemrushSiteAuditProjectId,
  formEditorialCountsPeriodStartYmd,
  formOptimizationPackage,
  formBenchmarkCustomTag,
  onFormNameChange,
  onFormSiteUrlChange,
  onFormProductionSiteUrlChange,
  onFormUsernameChange,
  onFormAppPasswordChange,
  onFormGa4PropertyIdChange,
  onFormGbpLocationIdChange,
  onFormSemrushSiteAuditProjectIdChange,
  onFormEditorialCountsPeriodStartYmdChange,
  onFormOptimizationPackageChange,
  onFormBenchmarkCustomTagChange,
  onPatchSite,
  patchSiteId,
  semrushActionsDisabled = false,
  className = "",
  layout = "accordion",
  settingsSubSectionId = "profile",
}) => {
  const hc = helpClass(chrome);
  const sh = strongHelpClass(chrome);
  const gbpFieldValue = formGbpLocationId.trim() || persistedGbpLocationId.trim();
  const ga4FieldValue = formGa4PropertyId.trim() || persistedGa4PropertyId.trim();
  const [semrushMatching, setSemrushMatching] = useState(false);

  const semrushBtnClass =
    chrome === "dark"
      ? cn(
          "h-10 min-h-10 gap-2 text-base font-medium",
          "border border-white/20 bg-transparent text-white shadow-none",
          "[&_svg]:text-white",
          "hover:bg-white/10 hover:text-white",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )
      : cn(WP_PANEL_TOOLBAR_BTN);

  const handleMatchSemrushProject = useCallback(async () => {
    const url = formSiteUrl.trim();
    if (!url) {
      notify.error(NOTIFY_SET_SITE_URL_WORDPRESS_REST_FIRST_THEN_T);
      return;
    }
    setSemrushMatching(true);
    try {
      const res = await matchSemrushProjectForSite(url);
      if (res.ok) {
        onFormSemrushSiteAuditProjectIdChange(res.projectId);
        if (onPatchSite && patchSiteId) {
          onPatchSite(patchSiteId, { semrushSiteAuditProjectId: res.projectId });
        }
        const label = res.matchedHost || res.projectName || res.projectId;
        const hint = res.ambiguous
          ? " Several projects matched this hostname; chose one (preferring Site Audit when possible)."
          : "";
        notify.success(notifyMatchedSemrushProjectXXX(res.projectId, label, hint));
      } else {
        notify.error(res.error);
        if (res.candidates?.length) {
          // eslint-disable-next-line no-console
          console.info("[Semrush] project candidates (no hostname match):", res.candidates);
        }
      }
    } finally {
      setSemrushMatching(false);
    }
  }, [formSiteUrl, onFormSemrushSiteAuditProjectIdChange, onPatchSite, patchSiteId]);

  const handlePushSemrushId = useCallback(() => {
    if (!onPatchSite || !patchSiteId) return;
    const v = formSemrushSiteAuditProjectId.trim();
    onPatchSite(patchSiteId, { semrushSiteAuditProjectId: v || undefined });
    notify.success(v ? "Project ID saved." : "Project ID cleared.");
  }, [formSemrushSiteAuditProjectId, onPatchSite, patchSiteId]);

  const semrushBusy = semrushMatching || semrushActionsDisabled;
  const canPatchSemrush = Boolean(onPatchSite && patchSiteId);

  const handleCopyUnifiedContentBankSql = useCallback(async () => {
    if (!patchSiteId) {
      notify.error(NOTIFY_SAVE_THE_PROPERTY_FIRST_SO_IT_HAS_A_STAB);
      return;
    }
    const label = formName.trim() || "Display name";
    const sql = buildUnifiedContentBankProvisioningSqlBlock(patchSiteId, label);
    try {
      await navigator.clipboard.writeText(sql);
      notify.success(NOTIFY_COPIED);
    } catch {
      notify.error(NOTIFY_CLIPBOARD_UNAVAILABLE);
    }
  }, [patchSiteId, formName]);

  const handleCopySiteId = useCallback(async () => {
    if (!patchSiteId) {
      notify.error(NOTIFY_SAVE_THE_PROPERTY_FIRST_SO_IT_HAS_A_STAB_2);
      return;
    }
    try {
      await navigator.clipboard.writeText(patchSiteId);
      notify.success(NOTIFY_SITE_ID_COPIED);
    } catch {
      notify.error(NOTIFY_CLIPBOARD_UNAVAILABLE);
    }
  }, [patchSiteId]);

  if (layout === "modalFlat") {
    const flatInputClass = TASK_FORM_FLAT_CONTROL_CLASS;

    const profileSection = (
      <TaskFormSideSection title="Profile">
        <TaskFormFlatGrid className="grid-cols-2">
          <TaskFormPlaceholderCell>
            <Input
              value={formName}
              onChange={(e) => onFormNameChange(e.target.value)}
              placeholder="Site name"
              aria-label="Site name"
              autoComplete="off"
              className={flatInputClass}
            />
          </TaskFormPlaceholderCell>
          <TaskFormPlaceholderCell>
            <Input
              value={formBenchmarkCustomTag}
              onChange={(e) => onFormBenchmarkCustomTagChange(e.target.value)}
              onBlur={() => {
                if (onPatchSite && patchSiteId) {
                  onPatchSite(patchSiteId, {
                    benchmarkCustomTag: formBenchmarkCustomTag.trim() || undefined,
                  });
                }
              }}
              placeholder="Benchmark category tag"
              aria-label="Benchmark category tag"
              maxLength={80}
              className={flatInputClass}
            />
          </TaskFormPlaceholderCell>
        </TaskFormFlatGrid>
      </TaskFormSideSection>
    );

    const accessSection = (
      <TaskFormSideSection title="Access">
        <TaskFormFlatGrid className="grid-cols-2">
          <TaskFormPlaceholderCell>
            <Input
              value={formSiteUrl}
              onChange={(e) => onFormSiteUrlChange(e.target.value)}
              placeholder="Site URL (WordPress / REST)"
              aria-label="Site URL"
              autoComplete="off"
              className={flatInputClass}
            />
          </TaskFormPlaceholderCell>
          <TaskFormPlaceholderCell>
            <Input
              value={formProductionSiteUrl}
              onChange={(e) => onFormProductionSiteUrlChange(e.target.value)}
              placeholder="Production URL (optional)"
              aria-label="Production URL"
              autoComplete="off"
              className={flatInputClass}
            />
          </TaskFormPlaceholderCell>
          <TaskFormPlaceholderCell>
            <Input
              value={formUsername}
              onChange={(e) => onFormUsernameChange(e.target.value)}
              placeholder="Username"
              aria-label="Username"
              autoComplete="off"
              className={flatInputClass}
            />
          </TaskFormPlaceholderCell>
          <TaskFormPlaceholderCell>
            <Input
              type="password"
              value={formAppPassword}
              onChange={(e) => onFormAppPasswordChange(e.target.value)}
              placeholder="Application password"
              aria-label="Application password"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              className={flatInputClass}
            />
          </TaskFormPlaceholderCell>
        </TaskFormFlatGrid>
      </TaskFormSideSection>
    );

    const integrationsSection = (
      <TaskFormSideSection title="Integrations">
        <TaskFormFlatGrid className="grid-cols-2">
          <TaskFormPlaceholderCell>
            <Input
              value={ga4FieldValue}
              onChange={(e) => onFormGa4PropertyIdChange(e.target.value)}
              onFocus={() => {
                if (!formGa4PropertyId.trim() && persistedGa4PropertyId.trim()) {
                  onFormGa4PropertyIdChange(persistedGa4PropertyId.trim());
                }
              }}
              placeholder="GA4 Property ID"
              aria-label="GA4 Property ID"
              className={flatInputClass}
            />
          </TaskFormPlaceholderCell>
          <TaskFormPlaceholderCell>
            <Input
              value={gbpFieldValue}
              onChange={(e) => onFormGbpLocationIdChange(e.target.value)}
              onFocus={() => {
                if (!formGbpLocationId.trim() && persistedGbpLocationId.trim()) {
                  onFormGbpLocationIdChange(persistedGbpLocationId.trim());
                }
              }}
              onBlur={() => {
                const persisted = persistGbpLocationIdInput(
                  formGbpLocationId || persistedGbpLocationId,
                );
                if (persisted && persisted !== formGbpLocationId) {
                  onFormGbpLocationIdChange(persisted);
                }
              }}
              placeholder="GBP Location ID"
              aria-label="GBP Location ID"
              className={flatInputClass}
            />
          </TaskFormPlaceholderCell>
          <TaskFormPlaceholderCell className="sm:col-span-2">
            <Input
              value={formSemrushSiteAuditProjectId}
              onChange={(e) => onFormSemrushSiteAuditProjectIdChange(e.target.value)}
              placeholder="Semrush Site Audit Project ID"
              aria-label="Semrush Site Audit Project ID"
              className={flatInputClass}
            />
          </TaskFormPlaceholderCell>
        </TaskFormFlatGrid>
        <div className="mt-1 flex flex-wrap items-center gap-2 px-1">
          <Button
            type="button"
            variant="outline"
            size="default"
            className={cn(
              "h-9 border-0 bg-[#000] text-base text-white hover:bg-[#000] hover:text-white",
              TASK_FORM_FLAT_CONTROL_CLASS,
            )}
            disabled={semrushBusy || !formSiteUrl.trim()}
            onClick={() => void handleMatchSemrushProject()}
          >
            {semrushMatching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Matching...
              </>
            ) : (
              "Match project from Semrush"
            )}
          </Button>
          {canPatchSemrush ? (
            <Button
              type="button"
              variant="outline"
              size="default"
              className="h-9 border-0 bg-[#000] text-base text-white hover:bg-[#000] hover:text-white"
              disabled={semrushBusy}
              onClick={handlePushSemrushId}
            >
              Save project ID now
            </Button>
          ) : null}
        </div>
      </TaskFormSideSection>
    );

    const editorialSection = (
      <TaskFormSideSection title="Editorial">
        <TaskFormFlatGrid className="grid-cols-2">
          <TaskFormPlaceholderCell>
            <Input
              type="date"
              value={formEditorialCountsPeriodStartYmd}
              onChange={(e) => onFormEditorialCountsPeriodStartYmdChange(e.target.value)}
              aria-label="Editorial counts period start"
              className={flatInputClass}
            />
          </TaskFormPlaceholderCell>
        </TaskFormFlatGrid>
        <div className="mt-2 flex flex-col gap-3 px-1">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="opt-period-limit-enabled-modal" className="text-base text-white">
              Optimization period limit
            </Label>
            <Switch
              id="opt-period-limit-enabled-modal"
              checked={Boolean(
                formOptimizationPackage?.trim() &&
                  isOptimizationPackageTier(formOptimizationPackage.trim()),
              )}
              onCheckedChange={(checked) => {
                if (!checked) {
                  onFormOptimizationPackageChange("");
                  if (onPatchSite && patchSiteId) {
                    onPatchSite(patchSiteId, { optimizationPackage: undefined });
                  }
                  return;
                }
                const tier =
                  formOptimizationPackage?.trim() &&
                  isOptimizationPackageTier(formOptimizationPackage.trim())
                    ? formOptimizationPackage.trim()
                    : "basic";
                onFormOptimizationPackageChange(tier);
                if (onPatchSite && patchSiteId) {
                  onPatchSite(patchSiteId, {
                    optimizationPackage: tier as WordPressSite["optimizationPackage"],
                  });
                }
              }}
            />
          </div>
          {formOptimizationPackage?.trim() &&
          isOptimizationPackageTier(formOptimizationPackage.trim()) ? (
            <RadioGroup
              value={formOptimizationPackage}
              onValueChange={(tier) => {
                onFormOptimizationPackageChange(tier);
                if (onPatchSite && patchSiteId && isOptimizationPackageTier(tier)) {
                  onPatchSite(patchSiteId, {
                    optimizationPackage: tier as WordPressSite["optimizationPackage"],
                  });
                }
              }}
              className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="basic" id="opt-pkg-basic-modal" />
                <Label htmlFor="opt-pkg-basic-modal" className="text-base text-white">
                  Basic (50)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="pro" id="opt-pkg-pro-modal" />
                <Label htmlFor="opt-pkg-pro-modal" className="text-base text-white">
                  Pro (100)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="plus" id="opt-pkg-plus-modal" />
                <Label htmlFor="opt-pkg-plus-modal" className="text-base text-white">
                  Plus (200)
                </Label>
              </div>
            </RadioGroup>
          ) : null}
        </div>
      </TaskFormSideSection>
    );

    const provisioningSection = (
      <TaskFormSideSection title="Provisioning">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-base text-muted-foreground">
              Copy the Supabase content bank SQL script for this property.
            </p>
            <Button
              type="button"
              variant="outline"
              className="h-9 shrink-0 border-0 bg-[#000] text-base text-white hover:bg-[#000] hover:text-white"
              disabled={!patchSiteId}
              onClick={() => void handleCopyUnifiedContentBankSql()}
            >
              <Copy className="h-4 w-4 shrink-0" aria-hidden />
              Copy SQL
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-base font-semibold text-white">WordPress plugin site ID</p>
              {patchSiteId ? (
                <p className="break-all font-mono text-base text-white">{patchSiteId}</p>
              ) : (
                <p className="text-base text-muted-foreground">Save the property first.</p>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-9 shrink-0 border-0 bg-[#000] text-base text-white hover:bg-[#000] hover:text-white"
              disabled={!patchSiteId}
              onClick={() => void handleCopySiteId()}
            >
              <Copy className="h-4 w-4 shrink-0" aria-hidden />
              Copy site ID
            </Button>
          </div>
        </div>
      </TaskFormSideSection>
    );

    const modalSections: Record<PropertySettingsSubSectionId, React.ReactNode> = {
      profile: profileSection,
      access: accessSection,
      integrations: integrationsSection,
      editorial: editorialSection,
      provisioning: provisioningSection,
    };

    return (
      <form
        className={cn("flex min-h-0 flex-1 flex-col gap-1 py-0 font-sans text-base", className)}
        autoComplete="off"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="grid min-h-0 w-full min-w-0">
          {PROPERTY_SETTINGS_SUB_SECTIONS.map(({ id }) => (
            <div
              key={id}
              className={cn(
                "col-start-1 row-start-1 min-w-0",
                settingsSubSectionId === id ? "visible" : "invisible pointer-events-none",
              )}
              aria-hidden={settingsSubSectionId !== id}
            >
              {modalSections[id]}
            </div>
          ))}
        </div>
      </form>
    );
  }

  return (
    <form
      className={cn("flex flex-col gap-0 py-1 font-sans text-base", className)}
      autoComplete="off"
      onSubmit={(e) => e.preventDefault()}
    >
      <FieldBlock
        chrome={chrome}
        label="Benchmark category tag"
        htmlFor="benchmarkCustomTag"
        span="full"
        field={
          <SitePropertyInput
            chrome={chrome}
            id="benchmarkCustomTag"
            name="neo-pulse_benchmark_custom_tag"
            value={formBenchmarkCustomTag}
            onChange={(e) => onFormBenchmarkCustomTagChange(e.target.value)}
            onBlur={() => {
              if (onPatchSite && patchSiteId) {
                onPatchSite(patchSiteId, {
                  benchmarkCustomTag: formBenchmarkCustomTag.trim() || undefined,
                });
              }
            }}
            placeholder="e.g. Interior design"
            maxLength={80}
          />
        }
      />

      <Accordion type="multiple" defaultValue={[]} className={cn("w-full", chrome === "light" && WP_PANEL_LIST_GAP)}>
        <AccordionItem value="wordpress" className={accordionItemClass(chrome)}>
          <AccordionTrigger className={accordionTriggerClass(chrome)}>WordPress & Credentials</AccordionTrigger>
          <AccordionContent className={accordionContentClass(chrome)}>
            <div className={fieldsGridClass(chrome)}>
            <FieldBlock
              chrome={chrome}
              label="Site Name"
              htmlFor="name"
              field={
                <SitePropertyInput
                  chrome={chrome}
                  id="name"
                  name="neo-pulse_property_label"
                  value={formName}
                  onChange={(e) => onFormNameChange(e.target.value)}
                  placeholder="My WordPress Site"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              }
            />

            <FieldBlock
              chrome={chrome}
              label="Username"
              htmlFor="username"
              field={
                <SitePropertyInput
                  chrome={chrome}
                  id="username"
                  name="neo_pulse_wp_api_username"
                  value={formUsername}
                  onChange={(e) => onFormUsernameChange(e.target.value)}
                  placeholder="admin"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              }
            />

            <FieldBlock
              chrome={chrome}
              label="Site URL (WordPress / REST)"
              htmlFor="siteUrl"
              span="full"
              field={
                <SitePropertyInput
                  chrome={chrome}
                  id="siteUrl"
                  name="neo-pulse_property_site_url"
                  value={formSiteUrl}
                  onChange={(e) => onFormSiteUrlChange(e.target.value)}
                  placeholder="https://staging-or-wp.example.com"
                  autoComplete="off"
                />
              }
              help={<p className={hc}>Used for Application Password API calls (staging is fine).</p>}
            />

            <FieldBlock
              chrome={chrome}
              label="Production URL (Optional)"
              htmlFor="productionSiteUrl"
              span="full"
              field={
                <SitePropertyInput
                  chrome={chrome}
                  id="productionSiteUrl"
                  name="neo-pulse_property_production_url"
                  value={formProductionSiteUrl}
                  onChange={(e) => onFormProductionSiteUrlChange(e.target.value)}
                  placeholder="https://www.client.com"
                  autoComplete="off"
                />
              }
              help={
                <p className={hc}>
                  Live site shown in Manager, research, and exports when it differs from the URL above.
                </p>
              }
            />

            <FieldBlock
              chrome={chrome}
              label="Application Password"
              htmlFor="appPassword"
              span="full"
              field={
                <SitePropertyInput
                  chrome={chrome}
                  id="appPassword"
                  name="neo_pulse_wp_api_application_token"
                  type="password"
                  value={formAppPassword}
                  onChange={(e) => onFormAppPasswordChange(e.target.value)}
                  placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                />
              }
              help={
                <p className={hc}>
                  Create an Application Password in WordPress: Users → Profile → Application Passwords
                </p>
              }
            />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="analytics" className={accordionItemClass(chrome)}>
          <AccordionTrigger className={accordionTriggerClass(chrome)}>Analytics & Business Profile</AccordionTrigger>
          <AccordionContent className={accordionContentClass(chrome)}>
            <div className={fieldsGridClass(chrome)}>
            <FieldBlock
              chrome={chrome}
              label="GA4 Property ID (Optional)"
              htmlFor="ga4PropertyId"
              field={
                <SitePropertyInput
                  chrome={chrome}
                  id="ga4PropertyId"
                  type="text"
                  value={ga4FieldValue}
                  onChange={(e) => onFormGa4PropertyIdChange(e.target.value)}
                  onFocus={() => {
                    if (!formGa4PropertyId.trim() && persistedGa4PropertyId.trim()) {
                      onFormGa4PropertyIdChange(persistedGa4PropertyId.trim());
                    }
                  }}
                  placeholder="e.g. 123456789"
                />
              }
              help={
                <p className={hc}>
                  Numeric ID from GA4 Admin → Property settings for this site. Used by the Test GA button on the site
                  tile.
                </p>
              }
            />

            <FieldBlock
              chrome={chrome}
              label="Google Business Profile Location ID (Optional)"
              htmlFor="gbpLocationId"
              span="full"
              field={
                <SitePropertyInput
                  chrome={chrome}
                  id="gbpLocationId"
                  type="text"
                  value={gbpFieldValue}
                  onChange={(e) => onFormGbpLocationIdChange(e.target.value)}
                  onFocus={() => {
                    if (!formGbpLocationId.trim() && persistedGbpLocationId.trim()) {
                      onFormGbpLocationIdChange(persistedGbpLocationId.trim());
                    }
                  }}
                  onBlur={() => {
                    const persisted = persistGbpLocationIdInput(
                      formGbpLocationId || persistedGbpLocationId,
                    );
                    if (persisted && persisted !== formGbpLocationId) {
                      onFormGbpLocationIdChange(persisted);
                    }
                  }}
                  placeholder="Paste full business.google.com profile URL or Advanced settings → Copy ID"
                />
              }
              help={
                <p className={hc}>
                  Paste the full profile URL (NEO Pulse uses <code className="rounded bg-muted px-1">fid=</code> when present, then{" "}
                  <code className="rounded bg-muted px-1">/n/...</code>), or use{" "}
                  <strong className={sh}>
                    Advanced settings → Copy ID
                  </strong>
                  . Connect Google Business with the account that owns this location.
                </p>
              }
            />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="semrush" className={accordionItemClass(chrome)}>
          <AccordionTrigger className={accordionTriggerClass(chrome)}>Semrush & Editorial</AccordionTrigger>
          <AccordionContent className={accordionContentClass(chrome)}>
            <div className={fieldsGridClass(chrome)}>
            <FieldBlock
              chrome={chrome}
              label="Semrush Site Audit Project ID (Optional)"
              htmlFor="semrushSiteAuditProjectId"
              span="full"
              field={
                <SitePropertyInput
                  chrome={chrome}
                  id="semrushSiteAuditProjectId"
                  type="text"
                  value={formSemrushSiteAuditProjectId}
                  onChange={(e) => onFormSemrushSiteAuditProjectIdChange(e.target.value)}
                  placeholder="e.g. 6647718 (from semrush.com/projects/...)"
                />
              }
              help={
                <p className={hc}>
                  Paste the numeric project ID from your Semrush Projects URL, or use{" "}
                  <strong className={sh}>Match project from Semrush</strong> below (uses Site URL). Used by the Meta
                  Optimizer AUDIT action for page-level Site Audit data.
                </p>
              }
            />

            <div
              className={cn(
                "flex w-full flex-col gap-1.5 py-1.5",
                chrome === "light" && "sm:col-span-2",
              )}
            >
              <span className={stackedLabelClass(chrome)}>Semrush tools</span>
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <Button
                  type="button"
                  variant={chrome === "light" ? "ghost" : "outline"}
                  size="default"
                  className={semrushBtnClass}
                  disabled={semrushBusy || !formSiteUrl.trim()}
                  onClick={() => void handleMatchSemrushProject()}
                >
                  {semrushMatching ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      Matching...
                    </>
                  ) : (
                    "Match project from Semrush"
                  )}
                </Button>
                {canPatchSemrush ? (
                  <Button
                    type="button"
                    variant={chrome === "light" ? "ghost" : "outline"}
                    size="default"
                    className={semrushBtnClass}
                    disabled={semrushBusy}
                    onClick={handlePushSemrushId}
                  >
                    Save project ID now
                  </Button>
                ) : null}
                <p className={cn(hc, "w-full")}>
                  {canPatchSemrush
                    ? "Match updates the field and saves immediately when this property already exists. Save project ID now pushes the current field value without using Save Property."
                    : "Match fills the project ID from your Semrush account; save the property to persist when adding a new site."}
                </p>
              </div>
            </div>

            <FieldBlock
              chrome={chrome}
              label="Editorial Counts Period Start (Optional)"
              htmlFor="editorialCountsPeriodStartYmd"
              span="full"
              field={
                <SitePropertyInput
                  chrome={chrome}
                  id="editorialCountsPeriodStartYmd"
                  type="date"
                  value={formEditorialCountsPeriodStartYmd}
                  onChange={(e) => onFormEditorialCountsPeriodStartYmdChange(e.target.value)}
                />
              }
              help={
                <p className={hc}>
                  When set, post and entity totals use rolling 3-month periods from this date. Leave blank to use calendar
                  quarters (Q1-Q4).
                </p>
              }
            />

            <div
              className={cn(
                "flex w-full flex-col gap-3 py-1.5",
                chrome === "light" && "sm:col-span-2",
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Label
                    htmlFor="opt-period-limit-enabled"
                    className={cn(stackedLabelClass(chrome), "cursor-pointer")}
                  >
                    Optimization period limit
                  </Label>
                  <p className={cn("mt-1 max-w-none", hc)}>
                    When off, the sparkle count on the property tile is hidden and bulk runs are not capped
                    (e.g. no 154/50).
                  </p>
                </div>
                <Switch
                  id="opt-period-limit-enabled"
                  checked={Boolean(
                    formOptimizationPackage?.trim() &&
                      isOptimizationPackageTier(formOptimizationPackage.trim()),
                  )}
                  onCheckedChange={(checked) => {
                    if (!checked) {
                      onFormOptimizationPackageChange("");
                      if (onPatchSite && patchSiteId) {
                        onPatchSite(patchSiteId, { optimizationPackage: undefined });
                      }
                      return;
                    }
                    const tier =
                      formOptimizationPackage?.trim() &&
                      isOptimizationPackageTier(formOptimizationPackage.trim())
                        ? formOptimizationPackage.trim()
                        : "basic";
                    onFormOptimizationPackageChange(tier);
                    if (onPatchSite && patchSiteId) {
                      onPatchSite(patchSiteId, {
                        optimizationPackage: tier as WordPressSite["optimizationPackage"],
                      });
                    }
                  }}
                />
              </div>
              {formOptimizationPackage?.trim() &&
              isOptimizationPackageTier(formOptimizationPackage.trim()) ? (
                <div className="flex w-full flex-col gap-1.5">
                  <Label className={stackedLabelClass(chrome)}>Package tier</Label>
                  <RadioGroup
                    value={formOptimizationPackage}
                    onValueChange={(tier) => {
                      onFormOptimizationPackageChange(tier);
                      if (onPatchSite && patchSiteId && isOptimizationPackageTier(tier)) {
                        onPatchSite(patchSiteId, {
                          optimizationPackage: tier as WordPressSite["optimizationPackage"],
                        });
                      }
                    }}
                    className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="basic" id="opt-pkg-basic" />
                      <Label htmlFor="opt-pkg-basic" className={radioOptionLabelClass(chrome)}>
                        Basic (50)
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="pro" id="opt-pkg-pro" />
                      <Label htmlFor="opt-pkg-pro" className={radioOptionLabelClass(chrome)}>
                        Pro (100)
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="plus" id="opt-pkg-plus" />
                      <Label htmlFor="opt-pkg-plus" className={radioOptionLabelClass(chrome)}>
                        Plus (200)
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              ) : null}
            </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="client-content-bank-supabase" className={accordionItemClass(chrome)}>
          <AccordionTrigger className={accordionTriggerClass(chrome)}>Supabase</AccordionTrigger>
          <AccordionContent className={accordionContentClass(chrome)}>
            <div className="flex flex-col gap-4 pt-0.5">
              <div
                className={cn(
                  "rounded-xl border p-4 sm:p-5",
                  chrome === "dark"
                    ? "border-white/12 bg-gradient-to-b from-white/[0.07] to-white/[0.02] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                    : "border-border/70 bg-gradient-to-b from-muted/80 to-muted/30 shadow-sm",
                )}
              >
                <div className="flex flex-col gap-1">
                  <p
                    className={cn(
                      SITE_PROPERTY_COPY,
                      "font-semibold uppercase tracking-[0.14em]",
                      chrome === "dark" ? "text-white/45" : "text-muted-foreground",
                    )}
                  >
                    Client content bank
                  </p>
                  <h4
                    className={cn(
                      SITE_PROPERTY_COPY,
                      "font-semibold",
                      chrome === "dark" ? "text-white" : "text-foreground",
                    )}
                  >
                    Provision tables in Supabase
                  </h4>
                  <p className={cn("max-w-none", hc)}>
                    Generates one paste-ready script for the SQL editor: required DDL, a PostgREST schema reload, and{" "}
                    <code className={inlineCodeClass(chrome)}>neo-pulse_ensure_content_bank</code> so this property gets
                    a per-site table named <code className={inlineCodeClass(chrome)}>{"content_bank_<site>"}</code>.
                  </p>
                </div>

                <ol className="mt-4 list-none space-y-2.5 p-0">
                  <li className={supabaseStepRowClass(chrome)}>
                    <span className={supabaseStepBadgeClass(chrome)} aria-hidden>
                      1
                    </span>
                    <div className="w-full flex-1 space-y-0.5">
                      <p className={cn("font-medium", SITE_PROPERTY_COPY, chrome === "dark" ? "text-white" : "text-foreground")}>
                        Save this property first
                      </p>
                      <p className={hc}>
                        The script is keyed to the site id shown here. Saving locks that id before you copy.
                      </p>
                    </div>
                  </li>
                  <li className={supabaseStepRowClass(chrome)}>
                    <span className={supabaseStepBadgeClass(chrome)} aria-hidden>
                      2
                    </span>
                    <div className="w-full flex-1 space-y-0.5">
                      <p className={cn("font-medium", SITE_PROPERTY_COPY, chrome === "dark" ? "text-white" : "text-foreground")}>
                        Copy the provisioning script
                      </p>
                      <p className={hc}>
                        Includes <code className={inlineCodeClass(chrome)}>NOTIFY pgrst</code> so PostgREST picks up new
                        objects after the migration runs.
                      </p>
                    </div>
                  </li>
                  <li className={supabaseStepRowClass(chrome)}>
                    <span className={supabaseStepBadgeClass(chrome)} aria-hidden>
                      3
                    </span>
                    <div className="w-full flex-1 space-y-0.5">
                      <p className={cn("font-medium", SITE_PROPERTY_COPY, chrome === "dark" ? "text-white" : "text-foreground")}>
                        Run in Supabase SQL editor
                      </p>
                      <p className={hc}>
                        Paste into the project database you use for NEO Pulse, execute, then verify the new table exists.
                      </p>
                    </div>
                  </li>
                </ol>
              </div>

              <div
                className={cn(
                  WP_PANEL_INSET_BAND,
                  "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
                  chrome === "dark" && "border border-white/10 bg-muted/25 shadow-none",
                )}
              >
                <div className="w-full space-y-1">
                  <p className={cn("font-semibold", SITE_PROPERTY_COPY, chrome === "dark" ? "text-white" : "text-foreground")}>
                    SQL script
                  </p>
                  <p className={hc}>
                    Copies the full block to your clipboard. Requires a saved property (site id).
                  </p>
                </div>
                <Button
                  type="button"
                  variant={chrome === "light" ? "default" : "outline"}
                  size="default"
                  className={
                    chrome === "dark"
                      ? semrushBtnClass
                      : "h-10 min-h-10 shrink-0 gap-2 px-4 text-base font-medium"
                  }
                  disabled={!patchSiteId}
                  onClick={() => void handleCopyUnifiedContentBankSql()}
                >
                  <Copy className="h-4 w-4 shrink-0" aria-hidden />
                  Copy SQL
                </Button>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="wordpress-plugin" className={accordionItemClass(chrome)}>
          <AccordionTrigger className={accordionTriggerClass(chrome)}>WordPress plugin</AccordionTrigger>
          <AccordionContent className={accordionContentClass(chrome)}>
            <div className="flex flex-col gap-4 pt-0.5">
              <p className={hc}>
                On the client site, open <strong className={sh}>NEO Pulse WP → Settings</strong>, paste this site ID, and
                click Connect.
              </p>
              <div
                className={cn(
                  WP_PANEL_INSET_BAND,
                  "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
                  chrome === "dark" && "border border-white/10 bg-muted/25 shadow-none",
                )}
              >
                <div className="w-full space-y-1">
                  <p className={cn("font-semibold", SITE_PROPERTY_COPY, chrome === "dark" ? "text-white" : "text-foreground")}>
                    Site ID
                  </p>
                  <p className={hc}>
                    {patchSiteId
                      ? "Copy into NEO Pulse WP → Settings on the client site."
                      : "Save the property first to lock in a site ID."}
                  </p>
                  {patchSiteId ? (
                    <p className={cn("break-all font-mono font-semibold", SITE_PROPERTY_COPY, chrome === "dark" ? "text-white" : "text-foreground")}>
                      {patchSiteId}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant={chrome === "light" ? "default" : "outline"}
                  size="default"
                  className={chrome === "dark" ? semrushBtnClass : "h-10 min-h-10 shrink-0 gap-2 px-4 text-base font-medium"}
                  disabled={!patchSiteId}
                  onClick={() => void handleCopySiteId()}
                >
                  <Copy className="h-4 w-4 shrink-0" aria-hidden />
                  Copy site ID
                </Button>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </form>
  );
};
