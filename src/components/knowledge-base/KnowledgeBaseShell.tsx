import { useMemo } from "react";
import { KnowledgeBaseFileRoster } from "@/components/knowledge-base/KnowledgeBaseFileRoster";
import { KnowledgeBaseWorkspaceHeader } from "@/components/knowledge-base/KnowledgeBaseWorkspaceHeader";
import { KnowledgeBaseTextPanel } from "@/components/knowledge-base/panels/KnowledgeBaseTextPanel";
import { KnowledgeBaseUploadPanel } from "@/components/knowledge-base/panels/KnowledgeBaseUploadPanel";
import {
  CONTENT_OPTIMIZER_BODY_INSET_CLASS,
  CONTENT_OPTIMIZER_WORKSPACE_SHELL_CLASS,
} from "@/components/overview/overview-tab/overview-tab-content-constants";
import {
  SEO_WORKSPACE_BODY_SCROLL_CLASS,
  SEO_WORKSPACE_HEADER_CLASS,
} from "@/components/seo/seo-workspace-layout";
import type { KnowledgeBaseController } from "@/hooks/knowledge-base/use-knowledge-base";
import { cn } from "@/lib/utils";

export type KnowledgeBaseShellProps = {
  controller: KnowledgeBaseController;
};

export function KnowledgeBaseShell({ controller: c }: KnowledgeBaseShellProps) {
  const toolbarProps = useMemo(
    () => ({
      activeSection: c.activeSection,
      disabled: c.workspaceBusy,
      profiles: c.profiles,
      selectedProfile: c.selectedProfile,
      onSelectedProfileChange: c.setSelectedProfile,
      newProfileName: c.newProfileName,
      onNewProfileNameChange: c.setNewProfileName,
      onSaveNewProfile: () => c.saveProfile(true),
      onUpdateProfile: () => c.saveProfile(false),
      onClearContent: c.clearContent,
      fileCount: c.files.length,
      totalSizeLabel: c.formatSize(c.totalSize),
      unstarredCount: c.unstarredCount,
      onClearUnstarred: c.clearUnstarredFiles,
      onClearAll: c.nukeKnowledgeBaseCache,
      scraperUrl: c.scraperUrl,
      onScraperUrlChange: c.setScraperUrl,
      scraperMaxPages: c.scraperMaxPages,
      onScraperMaxPagesChange: c.setScraperMaxPages,
      scraperRunning: c.scraperRunning,
      onStartScrape: c.handleStartScrape,
      onCancelScrape: c.handleCancelScrape,
    }),
    [c],
  );

  const detailsProps = useMemo(
    () => ({
      profileName: c.selectedProfile,
      fileCount: c.files.length,
      scraperUrl: c.scraperUrl,
      isUploading: c.isProcessing,
      uploadProgress: c.progress,
      isScraping: c.scraperRunning,
      scraperProgress: c.scraperProgress,
      scraperStep: c.scraperStep,
      scraperLog: c.scraperLog,
    }),
    [
      c.selectedProfile,
      c.files.length,
      c.scraperUrl,
      c.isProcessing,
      c.progress,
      c.scraperRunning,
      c.scraperProgress,
      c.scraperStep,
      c.scraperLog,
    ],
  );

  return (
    <div className={CONTENT_OPTIMIZER_WORKSPACE_SHELL_CLASS}>
      <div className={SEO_WORKSPACE_HEADER_CLASS}>
        <KnowledgeBaseWorkspaceHeader
          activeSection={c.activeSection}
          onSectionChange={c.setActiveSection}
          workspaceBusy={c.workspaceBusy}
          progressSnapshot={c.progressSnapshot}
          canOpenDetails={c.canOpenDetails}
          isProcessing={c.workspaceBusy}
          toolbarProps={toolbarProps}
          detailsProps={detailsProps}
        />
      </div>

      {c.activeSection !== "scraper" ? (
        <div className={cn(SEO_WORKSPACE_BODY_SCROLL_CLASS, CONTENT_OPTIMIZER_BODY_INSET_CLASS)}>
          {c.activeSection === "text" ? (
            <KnowledgeBaseTextPanel
              value={c.manualContent}
              onChange={c.setManualContent}
              disabled={c.workspaceBusy}
            />
          ) : null}

          {c.activeSection === "upload" ? (
            <KnowledgeBaseUploadPanel
              fileInputRef={c.fileInputRef}
              isDragging={c.isDragging}
              isProcessing={c.isProcessing}
              onFileChange={c.handleFileSelectorChange}
              onDragOver={c.handleDragOver}
              onDragLeave={c.handleDragLeave}
              onDrop={c.handleDrop}
              onDropZoneClick={c.handleDropZoneClick}
            />
          ) : null}

          {c.activeSection === "manager" ? (
            <KnowledgeBaseFileRoster
              files={c.files}
              formatSize={c.formatSize}
              onToggleStar={c.toggleStar}
              onDownload={c.downloadFile}
              onDelete={c.deleteFile}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
