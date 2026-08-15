import React, { useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  TASK_FORM_DIALOG_BUTTON_CLASS,
  TASK_PROJECT_DIALOG_CLASS,
} from "@/components/manager/tasks/TaskFormLayout";
import type { WordPressSite } from "../types";
import { wordpressSiteDisplayName } from "@/lib/wordpress-site-display-name";
import { WordPressPropertySectionPills } from "./WordPressPropertySectionPills";
import { buildWordPressPropertySections } from "./buildWordPressPropertySections";
import type { WordPressSiteAdminSectionId } from "./WordPressSiteAdminLayout";
import {
  PROPERTY_SETTINGS_SUB_SECTIONS,
  type PropertySettingsSubSectionId,
} from "./property-settings-types";

/** Fixed viewport height so main/settings nav never resizes the shell. */
const PROPERTY_PROFILE_DIALOG_CLASS = cn(TASK_PROJECT_DIALOG_CLASS, "h-[85vh] min-h-0 max-h-[85vh]");

export type PropertyProfileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site: WordPressSite | null;
  activeSectionId: WordPressSiteAdminSectionId;
  onActiveSectionChange: (id: WordPressSiteAdminSectionId) => void;
  settingsSubSectionId: PropertySettingsSubSectionId;
  onSettingsSubSectionChange: (id: PropertySettingsSubSectionId) => void;
  siteSettingsPanel: React.ReactNode;
  isTesting: boolean;
  isDetecting: boolean;
  isFetchingScheduled: boolean;
  isScrapingSitemap: Record<string, boolean>;
  isGeneratingEntities?: Record<string, boolean>;
  isIndexingSitemap?: Record<string, boolean>;
  isLoadingCalendar?: Record<string, boolean>;
  isExtractingNAPAndGraph?: boolean;
  onTest: () => void;
  onDetect: () => void;
  onScrapeChildSitemap: (childSitemapUrl: string) => void;
  onEntityGeneration?: (sitemapUrl: string) => void;
  onSetEntitySitemap?: (sitemapUrl: string) => void;
  onToggleChildSitemapDisabled?: (childSitemapUrl: string) => void;
  onAppendManualChildSitemap?: (url: string) => void;
  onIndexSitemap?: (sitemapUrl: string) => void;
  onLoadCalendarPosts?: (sitemapUrl: string) => void;
  onExtractNAPAndGraph?: () => void;
  getScrapingKey: (siteId: string, sitemapUrl: string) => string;
  onPatchSite?: (siteId: string, patch: Partial<WordPressSite>) => void;
  onSaveProperty?: () => void;
};

export function PropertyProfileDialog({
  open,
  onOpenChange,
  site,
  activeSectionId,
  onActiveSectionChange,
  settingsSubSectionId,
  onSettingsSubSectionChange,
  siteSettingsPanel,
  isTesting,
  isDetecting,
  isFetchingScheduled,
  isScrapingSitemap,
  isGeneratingEntities = {},
  isIndexingSitemap = {},
  isLoadingCalendar = {},
  isExtractingNAPAndGraph = false,
  onTest,
  onDetect,
  onScrapeChildSitemap,
  onEntityGeneration,
  onSetEntitySitemap,
  onToggleChildSitemapDisabled,
  onAppendManualChildSitemap,
  onIndexSitemap,
  onLoadCalendarPosts,
  onExtractNAPAndGraph,
  getScrapingKey,
  onPatchSite,
  onSaveProperty,
}: PropertyProfileDialogProps): React.ReactElement {
  useEffect(() => {
    if (!site) return;
    onActiveSectionChange("overview");
    onSettingsSubSectionChange("profile");
  }, [site?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const sections = useMemo(() => {
    if (!site) return [];
    return buildWordPressPropertySections({
      site,
      isTesting,
      isDetecting,
      isFetchingScheduled,
      isScrapingSitemap,
      isGeneratingEntities,
      isIndexingSitemap,
      isLoadingCalendar,
      isExtractingNAPAndGraph,
      onTest,
      onDetect,
      onScrapeChildSitemap,
      onEntityGeneration,
      onSetEntitySitemap,
      onToggleChildSitemapDisabled,
      onAppendManualChildSitemap,
      onIndexSitemap,
      onLoadCalendarPosts,
      onExtractNAPAndGraph,
      getScrapingKey,
      onPatchSite,
      shell: "modal",
      siteSettingsPanel,
    });
  }, [
    site,
    isTesting,
    isDetecting,
    isFetchingScheduled,
    isScrapingSitemap,
    isGeneratingEntities,
    isIndexingSitemap,
    isLoadingCalendar,
    isExtractingNAPAndGraph,
    onTest,
    onDetect,
    onScrapeChildSitemap,
    onEntityGeneration,
    onSetEntitySitemap,
    onToggleChildSitemapDisabled,
    onAppendManualChildSitemap,
    onIndexSitemap,
    onLoadCalendarPosts,
    onExtractNAPAndGraph,
    getScrapingKey,
    onPatchSite,
    siteSettingsPanel,
  ]);

  const activeSection = sections.find((s) => s.id === activeSectionId) ?? sections[0];
  const isSettings = activeSectionId === "site-settings";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={PROPERTY_PROFILE_DIALOG_CLASS}>
        <DialogHeader className="shrink-0 space-y-0 pb-1">
          <DialogTitle className="text-base font-semibold text-white">
            {site ? wordpressSiteDisplayName(site) : "Property profile"}
          </DialogTitle>
        </DialogHeader>

        <nav
          className="flex h-11 min-h-[2.75rem] shrink-0 items-center gap-1 bg-black px-3 py-2"
          aria-label="Property sections"
        >
          <WordPressPropertySectionPills
            sections={sections.map((s) => ({ id: s.id, label: s.label }))}
            activeSectionId={activeSectionId}
            onSectionChange={(id) => onActiveSectionChange(id as WordPressSiteAdminSectionId)}
          />
        </nav>

        {isSettings ? (
          <nav
            className="flex h-11 min-h-[2.75rem] shrink-0 items-center gap-1 bg-black px-3 py-2"
            aria-label="Settings sections"
          >
            <WordPressPropertySectionPills
              sections={PROPERTY_SETTINGS_SUB_SECTIONS}
              activeSectionId={settingsSubSectionId}
              onSectionChange={(id) =>
                onSettingsSubSectionChange(id as PropertySettingsSubSectionId)
              }
            />
          </nav>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-1">
            {activeSection?.content}
          </div>
        </div>

        <DialogFooter className="flex shrink-0 flex-row items-center justify-end gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-10 border-0 bg-[#000] text-base text-white hover:bg-[#000] hover:text-white",
              TASK_FORM_DIALOG_BUTTON_CLASS,
            )}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          {isSettings && onSaveProperty ? (
            <Button
              type="button"
              className={cn(
                "h-10 bg-[#77AA00] text-base text-black hover:bg-[#77AA00]/90",
                TASK_FORM_DIALOG_BUTTON_CLASS,
              )}
              onClick={onSaveProperty}
            >
              Save Property
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
