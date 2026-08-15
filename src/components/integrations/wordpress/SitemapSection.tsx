import React, { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  Download,
  ChevronDown,
  Tag,
  CheckCircle2,
  Sparkles,
  Search,
  FileSpreadsheet,
  Calendar as CalendarIcon,
  RefreshCw,
  Ban,
  Map,
} from "lucide-react";
import { type WordPressSite } from "../types";
import { PostCalendar } from "./PostCalendar";
import { PostPagePackGenerator } from "./PostPagePackGenerator";
import { cn } from "@/lib/utils";
import {
  WP_PANEL_SECTION_SHELL,
  WP_PANEL_LIST_GAP,
  WP_PANEL_ROW_TILE,
  WP_PANEL_MUTED,
  WP_PANEL_TOOLBAR_BTN,
} from "./wordpress-panel-chrome";

/** Scroll area: capped height; uses app-wide primary scrollbar from `index.css`. */
const smFlatScroll = "max-h-[min(50vh,420px)] overflow-y-auto";

const smMenuContent = cn("rounded-md border-0 bg-popover text-popover-foreground shadow-lg");
const smMenuItem =
  "cursor-pointer rounded-sm text-base text-popover-foreground focus:bg-accent focus:text-accent-foreground";
const smMenuSep = "bg-muted";
const smBtnRow = cn(
  "h-9 min-h-9 shrink-0 gap-1 rounded-md border-0 bg-secondary px-2.5 text-base text-foreground shadow-none",
  "hover:bg-tile-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
);
const smFieldWell = cn(
  "h-10 min-h-10 min-w-0 flex-1 rounded-md border-0 bg-muted text-base text-foreground shadow-none",
  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
);

type SitemapSectionLayout = "default" | "modalFlat";

function sitemapSectionChrome(layout: SitemapSectionLayout) {
  if (layout === "modalFlat") {
    return {
      sectionShell: "space-y-2",
      emptyShell: "flex flex-col items-center justify-center gap-3 py-10 text-center",
      muted: "text-base text-white/70",
      fieldWell:
        "h-10 min-h-10 min-w-0 flex-1 rounded-none border-0 bg-black text-base text-white shadow-none placeholder:text-white/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-0 focus-visible:ring-offset-black",
      btnRow:
        "h-10 min-h-10 shrink-0 gap-1 rounded-none border-0 bg-black px-3 text-base text-white shadow-none hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35",
      rowTile:
        "rounded-none border-0 bg-black px-3 py-2 text-base text-white shadow-none transition-colors",
      rowTileEntity: "bg-[#77AA00]/10 font-semibold text-white",
      urlText: "text-white",
      menuContent: "rounded-none border-0 bg-black text-white shadow-lg",
      menuItem:
        "cursor-pointer rounded-none text-base text-white focus:bg-white/10 focus:text-white",
      menuSep: "bg-white/10",
      badgeEntity: "h-9 shrink-0 rounded-none border-0 bg-black px-2 text-base text-[#77AA00]",
      badgeMuted: "h-9 shrink-0 rounded-none border-0 bg-black px-2 text-base text-white/70",
      badgeSecondary: "h-9 shrink-0 rounded-none border-0 bg-black px-2 text-base text-white/80",
      toolbarBtn: cn(
        "h-10 min-h-10 shrink-0 gap-1 rounded-none border-0 bg-black px-4 text-base text-white shadow-none",
        "hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35",
      ),
    };
  }
  return {
    sectionShell: cn(WP_PANEL_SECTION_SHELL, "space-y-2"),
    emptyShell: cn(WP_PANEL_SECTION_SHELL, "flex flex-col items-center justify-center gap-3 py-10 text-center"),
    muted: WP_PANEL_MUTED,
    fieldWell: smFieldWell,
    btnRow: smBtnRow,
    rowTile: WP_PANEL_ROW_TILE,
    rowTileEntity: "bg-muted font-semibold text-foreground",
    urlText: "text-foreground",
    menuContent: smMenuContent,
    menuItem: smMenuItem,
    menuSep: smMenuSep,
    badgeEntity: "h-9 shrink-0 rounded-md border-0 bg-secondary px-2 text-base text-foreground",
    badgeMuted: "h-9 shrink-0 rounded-md border-0 bg-muted px-2 text-base text-muted-foreground",
    badgeSecondary: "h-9 shrink-0 rounded-md border-0 bg-secondary px-2 text-base text-muted-foreground",
    toolbarBtn: cn(WP_PANEL_TOOLBAR_BTN, "px-4"),
  };
}

interface SitemapSectionProps {
  site: WordPressSite;
  layout?: SitemapSectionLayout;
  isScrapingSitemap: Record<string, boolean>;
  isGeneratingEntities?: Record<string, boolean>;
  isIndexingSitemap?: Record<string, boolean>;
  isLoadingCalendar?: Record<string, boolean>;
  getScrapingKey: (siteId: string, sitemapUrl: string) => string;
  onScrapeChildSitemap: (childSitemapUrl: string) => void;
  onEntityGeneration?: (sitemapUrl: string) => void;
  onSetEntitySitemap?: (sitemapUrl: string) => void;
  /** Per child sitemap row: mark disabled (stored on site.sitemaps.disabledChildSitemapUrls). */
  onToggleChildSitemapDisabled?: (childSitemapUrl: string) => void;
  onIndexSitemap?: (sitemapUrl: string) => void;
  onLoadCalendarPosts?: (sitemapUrl: string) => void;
  onRefreshSitemaps?: () => void;
  isRefreshingSitemaps?: boolean;
  onAppendManualChildSitemap?: (url: string) => void;
}

export const SitemapSection: React.FC<SitemapSectionProps> = ({
  site,
  layout = "default",
  isScrapingSitemap,
  isGeneratingEntities = {},
  isIndexingSitemap = {},
  isLoadingCalendar = {},
  getScrapingKey,
  onScrapeChildSitemap,
  onEntityGeneration,
  onSetEntitySitemap,
  onToggleChildSitemapDisabled,
  onIndexSitemap,
  onLoadCalendarPosts,
  onRefreshSitemaps,
  isRefreshingSitemaps = false,
  onAppendManualChildSitemap,
}) => {
  const chrome = sitemapSectionChrome(layout);
  const [openCalendars, setOpenCalendars] = useState<Record<string, boolean>>({});
  const [openPackGenerator, setOpenPackGenerator] = useState<Record<string, boolean>>({});
  const [manualSitemapUrl, setManualSitemapUrl] = useState("");

  const handleCalendarOpenChange = useCallback((sitemapUrl: string, open: boolean) => {
    setOpenCalendars(prev => ({ ...prev, [sitemapUrl]: open }));
    if (open && onLoadCalendarPosts) {
      const postMetadata = site.sitemaps?.postMetadata?.[sitemapUrl];
      if (!postMetadata || !postMetadata.posts || postMetadata.posts.length === 0) {
        onLoadCalendarPosts(sitemapUrl);
      }
    }
  }, [site.sitemaps, onLoadCalendarPosts]);

  const submitManualSitemap = useCallback(() => {
    if (!onAppendManualChildSitemap) return;
    onAppendManualChildSitemap(manualSitemapUrl);
    setManualSitemapUrl("");
  }, [manualSitemapUrl, onAppendManualChildSitemap]);

  if (!site.sitemaps) {
    return (
      <div className={chrome.emptyShell}>
        <p className={chrome.muted}>No sitemaps detected for this property yet.</p>
        {onRefreshSitemaps ? (
          <Button
            type="button"
            variant="ghost"
            disabled={site.enabled === false || isRefreshingSitemaps}
            className={chrome.toolbarBtn}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRefreshSitemaps();
            }}
          >
            {isRefreshingSitemaps ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <Map className="h-4 w-4 shrink-0" aria-hidden />
            )}
            {isRefreshingSitemaps ? "Detecting Sitemaps…" : "Detect Sitemaps"}
          </Button>
        ) : null}
      </div>
    );
  }

  const mainSitemapUrl = site.sitemaps.mainSitemapUrl?.replace(
    "/wp-sitemap.xml",
    "/sitemap_index.xml",
  );

  return (
    <div className={chrome.sectionShell}>
      {site.sitemaps.type === "index" && site.sitemaps.childSitemaps && (
        <div className="space-y-2">
          {(onAppendManualChildSitemap || onRefreshSitemaps) && (
            <div className="flex flex-wrap items-center gap-1">
              {onAppendManualChildSitemap && (
                <>
                  <Input
                    value={manualSitemapUrl}
                    onChange={(e) => setManualSitemapUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        submitManualSitemap();
                      }
                    }}
                    placeholder="https://example.com/custom-sitemap.xml"
                    disabled={site.enabled === false}
                    className={chrome.fieldWell}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={site.enabled === false}
                    className={cn(chrome.btnRow, "h-10 min-h-10 px-3")}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      submitManualSitemap();
                    }}
                  >
                    Add
                  </Button>
                </>
              )}
              {onRefreshSitemaps && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={site.enabled === false || isRefreshingSitemaps}
                  title={mainSitemapUrl}
                  aria-label="Redetect sitemaps"
                  className={cn(chrome.btnRow, "h-10 min-h-10 w-10 shrink-0 p-0")}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRefreshSitemaps();
                  }}
                >
                  {isRefreshingSitemaps ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <RefreshCw className="h-4 w-4" aria-hidden />
                  )}
                </Button>
              )}
            </div>
          )}
          <div className={cn(WP_PANEL_LIST_GAP, smFlatScroll)}>
            {site.sitemaps.childSitemaps.map((url, idx) => {
              const isEntityRow = site.entitySitemapUrl === url;
              const rowDisabled =
                site.sitemaps?.disabledChildSitemapUrls?.includes(url) ?? false;
              const scrapingKey = getScrapingKey(site.id, url);
              const isScraping = isScrapingSitemap[scrapingKey] || false;
              const generatingKey = `${site.id}-${url}`;
              const isGenerating = isGeneratingEntities[generatingKey] || false;
              const indexingKey = `${site.id}-${url}`;
              const isIndexing = isIndexingSitemap[indexingKey] || false;
              const sitemapName = url.split('/').pop()?.replace('-sitemap.xml', '').replace('_sitemap.xml', '').replace('-', ' ').replace('_', ' ') || 'Pack';
              const packName = sitemapName.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') + ' Pack';
              const loadingKey = `${site.id}-${url}`;
              const isLoading = isLoadingCalendar[loadingKey] || false;
              const postMetadata = site.sitemaps?.postMetadata?.[url];
              const posts = postMetadata?.posts || [];
              const futureCount = posts.filter(post => {
                if (!post.date_gmt) return false;
                try {
                  const postDate = new Date(post.date_gmt);
                  return postDate > new Date() || post.status === 'future';
                } catch {
                  return false;
                }
              }).length;
              
              return (
                <div
                  key={idx}
                  className={cn(
                    chrome.rowTile,
                    "flex flex-wrap items-center gap-2 py-2.5 pr-1",
                    site.entitySitemapUrl === url && chrome.rowTileEntity,
                  )}
                >
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-base",
                        chrome.urlText,
                        site.entitySitemapUrl !== url && "font-normal",
                      )}
                    >
                      {url}
                    </span>
                    {site.entitySitemapUrl === url && (
                      <Badge
                        variant="secondary"
                        className={chrome.badgeEntity}
                      >
                        <Tag className="mr-1 h-4 w-4" />
                        Entity
                      </Badge>
                    )}
                    {rowDisabled && (
                      <Badge
                        variant="secondary"
                        className={chrome.badgeMuted}
                      >
                        Excluded
                      </Badge>
                    )}
                    {futureCount > 0 && (
                      <Badge
                        variant="secondary"
                        className={chrome.badgeSecondary}
                      >
                        {futureCount} Future
                      </Badge>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isScraping || site.enabled === false}
                          className={cn(chrome.btnRow, "h-10 min-h-10 shrink-0 gap-1.5 px-3")}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                        >
                          {isScraping ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Working…</span>
                            </>
                          ) : (
                            <>
                              <Map className="h-4 w-4" />
                              <span>Sitemap</span>
                              <ChevronDown className="h-4 w-4 opacity-50" />
                            </>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        onClick={(e) => e.stopPropagation()}
                        className={chrome.menuContent}
                      >
                        {onToggleChildSitemapDisabled && !isEntityRow ? (
                          <>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onToggleChildSitemapDisabled(url);
                              }}
                              disabled={site.enabled === false}
                              className={chrome.menuItem}
                            >
                              {rowDisabled ? (
                                <>
                                  <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden />
                                  Include in property
                                </>
                              ) : (
                                <>
                                  <Ban className="mr-2 h-4 w-4" aria-hidden />
                                  Exclude from property
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className={chrome.menuSep} />
                          </>
                        ) : null}
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onScrapeChildSitemap(url);
                          }}
                          disabled={isScraping || site.enabled === false || rowDisabled}
                          className={chrome.menuItem}
                        >
                          {isScraping ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Scraping...
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-2" />
                              Scrape Sitemap
                            </>
                          )}
                        </DropdownMenuItem>
                        {onIndexSitemap && (
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onIndexSitemap(url);
                            }}
                            disabled={
                              isIndexing || isScraping || site.enabled === false || rowDisabled
                            }
                            className={chrome.menuItem}
                          >
                            {isIndexing ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Indexing...
                              </>
                            ) : (
                              <>
                                <Search className="h-4 w-4 mr-2" />
                                Check & Request Indexing
                              </>
                            )}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpenPackGenerator(prev => ({ ...prev, [url]: true }));
                          }}
                          disabled={site.enabled === false || rowDisabled}
                          className={chrome.menuItem}
                        >
                          <FileSpreadsheet className="h-4 w-4 mr-2" />
                          Generate {packName}
                        </DropdownMenuItem>
                        {onSetEntitySitemap ? (
                          <>
                            <DropdownMenuSeparator className={chrome.menuSep} />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onSetEntitySitemap(url);
                              }}
                              disabled={site.enabled === false || rowDisabled}
                              className={chrome.menuItem}
                            >
                              {site.entitySitemapUrl === url ? (
                                <>
                                  <Ban className="mr-2 h-4 w-4" aria-hidden />
                                  Clear entity sitemap
                                </>
                              ) : (
                                <>
                                  <Tag className="mr-2 h-4 w-4" aria-hidden />
                                  Set as entity sitemap
                                </>
                              )}
                            </DropdownMenuItem>
                            {site.entitySitemapUrl === url && onEntityGeneration && (
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  // Use site.entitySitemapUrl instead of the clicked URL
                                  // This ensures we use the entity sitemap the user has set
                                  const entitySitemapUrl = site.entitySitemapUrl || url;
                                  onEntityGeneration(entitySitemapUrl);
                                }}
                                disabled={isGenerating || site.enabled === false || rowDisabled}
                                className={chrome.menuItem}
                              >
                                {isGenerating ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Generating Entities...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Generate Origins
                                  </>
                                )}
                              </DropdownMenuItem>
                            )}
                          </>
                        ) : null}
                        {(onLoadCalendarPosts || openCalendars[url]) && (
                          <>
                            <DropdownMenuSeparator className={chrome.menuSep} />
                            <DropdownMenuItem
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (onLoadCalendarPosts) {
                                  const postMetadata = site.sitemaps?.postMetadata?.[url];
                                  if (!postMetadata || !postMetadata.posts || postMetadata.posts.length === 0) {
                                    setOpenCalendars(prev => ({ ...prev, [url]: true }));
                                    onLoadCalendarPosts(url);
                                  } else {
                                    setOpenCalendars(prev => ({ ...prev, [url]: !prev[url] }));
                                  }
                                } else {
                                  setOpenCalendars(prev => ({ ...prev, [url]: !prev[url] }));
                                }
                              }}
                              disabled={isLoading || site.enabled === false || rowDisabled}
                              className={chrome.menuItem}
                            >
                              {isLoading ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Loading Calendar...
                                </>
                              ) : (
                                <>
                                  <CalendarIcon className="h-4 w-4 mr-2" />
                                  View Post Schedule Calendar
                                </>
                              )}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <PostPagePackGenerator
                      key={`pack-${url}`}
                      open={openPackGenerator[url] || false}
                      onOpenChange={(open) => {
                        setOpenPackGenerator(prev => ({ ...prev, [url]: open }));
                      }}
                      site={site}
                      sitemapUrl={url}
                      postType="post"
                    />
                    <Dialog
                      open={openCalendars[url] || false}
                      onOpenChange={(open) => {
                        handleCalendarOpenChange(url, open);
                      }}
                    >
                      <DialogContent
                        className="max-w-4xl w-full rounded-lg border-0 bg-card p-0 text-foreground shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                        onOpenAutoFocus={(e) => e.preventDefault()}
                      >
                        {isLoading ? (
                          <div className={cn("flex items-center gap-3 p-4 text-base text-foreground")}>
                            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                            Loading posts from WordPress API...
                          </div>
                        ) : posts.length > 0 ? (
                          <div className="p-3" key={`calendar-${url}-${posts.length}`}>
                            <PostCalendar 
                              posts={posts} 
                              sitemapUrl={url}
                              onRefresh={() => onLoadCalendarPosts?.(url)}
                              isRefreshing={isLoading}
                            />
                          </div>
                        ) : (
                          <div className={cn("p-4 text-center text-base", chrome.muted)}>
                            No post metadata available. Loading...
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {site.sitemaps.type === "urlset" && site.sitemaps.urls && (
        <div className="space-y-2">
          {(onAppendManualChildSitemap || onRefreshSitemaps) && (
            <div className="flex flex-wrap items-center gap-1">
              {onAppendManualChildSitemap && (
                <>
                  <Input
                    value={manualSitemapUrl}
                    onChange={(e) => setManualSitemapUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        submitManualSitemap();
                      }
                    }}
                    placeholder="https://example.com/page/"
                    disabled={site.enabled === false}
                    className={chrome.fieldWell}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={site.enabled === false}
                    className={cn(chrome.btnRow, "h-10 min-h-10 px-3")}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      submitManualSitemap();
                    }}
                  >
                    Add
                  </Button>
                </>
              )}
              {onRefreshSitemaps && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={site.enabled === false || isRefreshingSitemaps}
                  title={mainSitemapUrl}
                  aria-label="Redetect sitemaps"
                  className={cn(chrome.btnRow, "h-10 min-h-10 w-10 shrink-0 p-0")}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRefreshSitemaps();
                  }}
                >
                  {isRefreshingSitemaps ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <RefreshCw className="h-4 w-4" aria-hidden />
                  )}
                </Button>
              )}
            </div>
          )}
          <div className={WP_PANEL_LIST_GAP}>
            {site.sitemaps.urls.slice(0, 10).map((url, idx) => (
              <div key={idx} className={cn(chrome.rowTile, "truncate px-3 py-2")}>
                {url}
              </div>
            ))}
            {site.sitemaps.urls.length > 10 && (
              <div className={cn("rounded-none px-3 py-2 text-base", chrome.muted)}>
                +{site.sitemaps.urls.length - 10} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

