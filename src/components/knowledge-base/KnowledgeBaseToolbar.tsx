import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BULK_HEADER_FIELD,
  BULK_HEADER_RUN_BTN,
  BULK_TOOLBAR_GROUP_DIVIDER,
} from "@/components/keyword-research/bulk/bulk-workspace-header-styles";
import type { KnowledgeBaseSectionId, KnowledgeProfile } from "@/lib/knowledge-base/types";
import { cn } from "@/lib/utils";

export type KnowledgeBaseToolbarProps = {
  activeSection: KnowledgeBaseSectionId;
  disabled: boolean;
  profiles: KnowledgeProfile[];
  selectedProfile: string;
  onSelectedProfileChange: (id: string) => void;
  newProfileName: string;
  onNewProfileNameChange: (value: string) => void;
  onSaveNewProfile: () => void;
  onUpdateProfile: () => void;
  onClearContent: () => void;
  fileCount: number;
  totalSizeLabel: string;
  unstarredCount: number;
  onClearUnstarred: () => void;
  onClearAll: () => void;
  scraperUrl: string;
  onScraperUrlChange: (value: string) => void;
  scraperMaxPages: number;
  onScraperMaxPagesChange: (value: number) => void;
  scraperRunning: boolean;
  onStartScrape: () => void;
  onCancelScrape: () => void;
};

export function KnowledgeBaseToolbar({
  activeSection,
  disabled,
  profiles,
  selectedProfile,
  onSelectedProfileChange,
  newProfileName,
  onNewProfileNameChange,
  onSaveNewProfile,
  onUpdateProfile,
  onClearContent,
  fileCount,
  totalSizeLabel,
  unstarredCount,
  onClearUnstarred,
  onClearAll,
  scraperUrl,
  onScraperUrlChange,
  scraperMaxPages,
  onScraperMaxPagesChange,
  scraperRunning,
  onStartScrape,
  onCancelScrape,
}: KnowledgeBaseToolbarProps) {
  if (activeSection === "text") {
    return (
      <>
        <Select value={selectedProfile} onValueChange={onSelectedProfileChange} disabled={disabled}>
          <SelectTrigger className={cn(BULK_HEADER_FIELD, "h-8 w-[min(100%,10rem)] shrink-0")}>
            <SelectValue placeholder="Select profile" />
          </SelectTrigger>
          <SelectContent>
            {profiles.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={newProfileName}
          onChange={(e) => onNewProfileNameChange(e.target.value)}
          placeholder="New profile name"
          disabled={disabled}
          className={cn(BULK_HEADER_FIELD, "h-8 min-w-0 flex-1 px-2")}
        />
        <Button
          type="button"
          size="sm"
          className={BULK_HEADER_RUN_BTN}
          disabled={disabled}
          onClick={onSaveNewProfile}
        >
          Save New
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 shrink-0"
          disabled={disabled || !selectedProfile}
          onClick={onUpdateProfile}
        >
          Update
        </Button>
        <div className={BULK_TOOLBAR_GROUP_DIVIDER} aria-hidden />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 shrink-0 text-destructive hover:text-destructive"
          disabled={disabled}
          onClick={onClearContent}
        >
          Clear Content
        </Button>
      </>
    );
  }

  if (activeSection === "upload") {
    return (
      <span className="text-base text-muted-foreground">
        Drag and drop or click the zone below. Accepts .txt, .md, .pdf, .json, .csv
      </span>
    );
  }

  if (activeSection === "manager") {
    return (
      <>
        <span className="text-base text-muted-foreground">
          {fileCount} files · {totalSizeLabel}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {unstarredCount > 0 ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 shrink-0 text-destructive"
              disabled={disabled}
              onClick={onClearUnstarred}
            >
              <Trash2 className="mr-1 h-4 w-4" aria-hidden />
              Clear temp ({unstarredCount})
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0 text-destructive"
            disabled={disabled || fileCount === 0}
            onClick={onClearAll}
          >
            Clear all
          </Button>
        </div>
      </>
    );
  }

  if (activeSection === "scraper") {
    return (
      <>
        <Input
          value={scraperUrl}
          onChange={(e) => onScraperUrlChange(e.target.value)}
          placeholder="https://example.com"
          disabled={disabled || scraperRunning}
          aria-label="Site URL to scrape"
          className={cn(BULK_HEADER_FIELD, "h-8 min-w-0 flex-1 px-2")}
        />
        <Input
          type="number"
          min={1}
          max={200}
          value={scraperMaxPages}
          disabled={disabled || scraperRunning}
          aria-label="Max pages"
          onChange={(e) => {
            const parsed = parseInt(e.target.value, 10);
            onScraperMaxPagesChange(
              Math.max(1, Math.min(200, Number.isNaN(parsed) ? 1 : parsed)),
            );
          }}
          className={cn(BULK_HEADER_FIELD, "h-8 w-[4.5rem] shrink-0 px-2 tabular-nums")}
        />
        <Button
          type="button"
          size="sm"
          className={BULK_HEADER_RUN_BTN}
          disabled={disabled || scraperRunning}
          onClick={onStartScrape}
        >
          {scraperRunning ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />
              Scraping
            </>
          ) : (
            "Start"
          )}
        </Button>
        {scraperRunning ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 shrink-0 text-destructive"
            onClick={onCancelScrape}
          >
            Cancel
          </Button>
        ) : null}
      </>
    );
  }

  return null;
}
