import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { notify, notifyHeaderError } from "@/lib/app-notifications";
import { NOTIFY_ALREADY_IN_LIST, NOTIFY_CLEAR_ENTITY_SITEMAP_IN_THE_SITEMAP_MENU, NOTIFY_COULD_NOT_RESOLVE_ANY_URLS_TO_WORDPRESS_, NOTIFY_ENTER_A_SITE_NAME, NOTIFY_ENTITY_SITEMAP_CLEARED, NOTIFY_INDEXING_SITEMAP, NOTIFY_NO_POSTS_FOUND, NOTIFY_NO_URLS_FOUND_IN_SITEMAP, NOTIFY_NO_URLS_FOUND_IN_THIS_SITEMAP_PLEASE_CHE, NOTIFY_PLEASE_DETECT_SITEMAPS_FIRST, NOTIFY_PLEASE_DETECT_SITEMAPS_FIRST_BEFORE_SCRA, NOTIFY_SITEMAP_ADDED, NOTIFY_SITEMAP_EXCLUDED_FOR_THIS_PROPERTY, NOTIFY_SITEMAP_INCLUDED_FOR_THIS_PROPERTY, NOTIFY_SITE_CONNECTION_DELETED, NOTIFY_THIS_SITEMAP_IS_AN_INDEX_CONTAINS_OTHER_, notifyConnectionFailedX, notifyConnectionSuccessfulX, notifyDeletedXSiteS, notifyDetectedXEndpointSX, notifyEntitySitemapAutoDetectedX, notifyEntitySitemapSetToX, notifyFailedToFetchScheduledPostsX, notifyFoundXFuturePostxInSitemap, notifyIndexingDoneXIndexedXErr, notifyIndexingFailedX, notifyIndexingXXXOkXErr, notifyLoadedXPostsWithDatesXFuture, notifyLoadingXPostsFromSitemap, notifySitemapDetectedX } from "@/lib/notify-messages";
import { clearSiteMirrorIndexCache } from "@/lib/wordpress-api/fields-client";
import { 
  testWordPressConnection,
  detectSitemaps,
  parseSitemap,
  getScheduledPosts,
  indexSitemapUrls,
  checkFuturePosts,
  resolveWordPressUrls,
  getWordPressPostContent,
  type IndexingProgress,
} from "@/lib/wordpress-api";
import { getStoredSites, saveSites } from "@/components/integrations/storage";
import { type WordPressSite } from "@/components/integrations/types";
import { isOptimizationPackageTier } from "@/lib/wordpress-optimization-package";
import { scrapeChildSitemap } from "@/lib/wordpress-sitemap-scraper";
import { extractNAPAndSaveToSiteSilent, triggerKnowledgeGraphWorkflow } from "@/lib/knowledge-graph-auto-trigger";
import { detectEntitySitemap } from "@/lib/entity-sitemap-detector";
import {
  canWarmEntitySite,
  clearEntitySiteWarmCache,
  invalidateEntitySiteWarmCacheIfCredentialsChanged,
  warmEntitySiteCache,
} from "@/lib/local-analysis/entity-site-warm-cache";

/** Default list order: site name A-Z (case-insensitive), then URL, then id. */
function compareWordPressSitesByDisplayName(a: WordPressSite, b: WordPressSite): number {
  const nameCmp = (a.name ?? "").trim().localeCompare((b.name ?? "").trim(), undefined, {
    sensitivity: "base",
  });
  if (nameCmp !== 0) return nameCmp;
  const urlCmp = (a.siteUrl ?? "").trim().localeCompare((b.siteUrl ?? "").trim(), undefined, {
    sensitivity: "base",
  });
  if (urlCmp !== 0) return urlCmp;
  return a.id.localeCompare(b.id);
}

function sortWordPressSitesByDisplayName(list: WordPressSite[]): WordPressSite[] {
  return [...list].sort(compareWordPressSitesByDisplayName);
}

function useWordPressSitesState() {
  const [sites, setSites] = useState<WordPressSite[]>(() => getStoredSites());
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState<string | null>(null);
  const [isFetchingScheduled, setIsFetchingScheduled] = useState<string | null>(null);
  const [isScrapingSitemap, setIsScrapingSitemap] = useState<Record<string, boolean>>({});
  const [isIndexingSitemap, setIsIndexingSitemap] = useState<Record<string, boolean>>({});
  const [isCheckingFuture, setIsCheckingFuture] = useState<Record<string, boolean>>({});
  const [isLoadingCalendar, setIsLoadingCalendar] = useState<Record<string, boolean>>({});

  const sitesSortedByName = useMemo(
    () => sortWordPressSitesByDisplayName(sites),
    [sites],
  );

  const handleAddSite = useCallback(() => {
    return {
      name: "",
      siteUrl: "",
      productionSiteUrl: "",
      username: "",
      appPassword: "",
      ga4PropertyId: "",
      gbpLocationId: "",
      semrushSiteAuditProjectId: "",
      editorialCountsPeriodStartYmd: "",
      benchmarkCustomTag: "",
      slackEnabledForProperty: true,
      slackChannelId: "",
      slackChannelName: "",
      slackIncomingWebhookUrl: "",
      slackMentionSnippet: "",
      postBankEnabled: true,
    };
  }, []);

  const handleEditSite = useCallback((site: WordPressSite) => {
    return {
      name: site.name,
      siteUrl: site.siteUrl,
      productionSiteUrl: site.productionSiteUrl ?? "",
      username: site.username,
      appPassword: site.appPassword,
      ga4PropertyId: site.ga4PropertyId ?? "",
      gbpLocationId: site.gbpLocationId ?? "",
      semrushSiteAuditProjectId: site.semrushSiteAuditProjectId ?? "",
      editorialCountsPeriodStartYmd: site.editorialCountsPeriodStartYmd ?? "",
      optimizationPackage:
        site.optimizationPackage?.trim() && isOptimizationPackageTier(site.optimizationPackage.trim())
          ? site.optimizationPackage.trim()
          : "",
      benchmarkCustomTag: site.benchmarkCustomTag?.trim() ?? "",
      slackEnabledForProperty: site.slackEnabledForProperty !== false,
      slackChannelId: site.slackChannelId ?? "",
      slackChannelName: site.slackChannelName ?? "",
      slackIncomingWebhookUrl: site.slackIncomingWebhookUrl ?? "",
      slackMentionSnippet: site.slackMentionSnippet ?? "",
    };
  }, []);

  const handleDeleteSite = useCallback((id: string) => {
    const updated = sites.filter((s) => s.id !== id);
    setSites(updated);
    saveSites(updated);
    clearEntitySiteWarmCache(id);
    notify.success(NOTIFY_SITE_CONNECTION_DELETED);
  }, [sites]);

  const handleDeleteSitesBulk = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    const idSet = new Set(ids);
    const updated = sites.filter((s) => !idSet.has(s.id));
    setSites(updated);
    saveSites(updated);
    for (const id of ids) {
      clearEntitySiteWarmCache(id);
    }
    notify.success(notifyDeletedXSiteS(ids.length));
  }, [sites]);

  const handleToggleEnabled = useCallback((site: WordPressSite) => {
    const isCurrentlyEnabled = site.enabled !== false;
    const newEnabledState = !isCurrentlyEnabled;
    
    // If enabling this site, disable all others
    // If disabling this site, just disable this one
    const updated = sites.map(s => {
      if (s.id === site.id) {
        return { ...s, enabled: newEnabledState };
      } else if (newEnabledState) {
        // If we're enabling the current site, disable all others
        return { ...s, enabled: false };
      }
      return s;
    });
    
    setSites(updated);
    saveSites(updated);
  }, [sites]);

  /** Enable exactly one property (manager header site picker). */
  const handleConnectSite = useCallback((site: WordPressSite) => {
    const updated = sites.map((s) => ({
      ...s,
      enabled: s.id === site.id,
    }));
    setSites(updated);
    saveSites(updated);
    warmEntitySiteCache(site);
  }, [sites]);

  const handleTestConnection = useCallback(async (site: WordPressSite): Promise<boolean> => {
    setIsTesting(site.id);
    setSites(prev => {
      const updated = prev.map(s =>
        s.id === site.id ? { ...s, connectionStatus: 'testing' as const } : s
      );
      saveSites(updated);
      return updated;
    });

    try {
      const result = await testWordPressConnection(
        site.siteUrl,
        site.username,
        site.appPassword
      );

      setSites(prev => {
        const finalUpdated = prev.map(s =>
          s.id === site.id
            ? {
                ...s,
                connectionStatus: result.success ? ('success' as const) : ('failed' as const),
                lastTested: Date.now(),
                capabilities: result.success && result.capabilities ? result.capabilities : s.capabilities,
              }
            : s
        );
        saveSites(finalUpdated);
        return finalUpdated;
      });

      if (result.success) {
        clearSiteMirrorIndexCache(site.id);
        notify.success(notifyConnectionSuccessfulX(result.siteInfo?.name || site.name));
        void extractNAPAndSaveToSiteSilent(site);
        warmEntitySiteCache(site);
      } else {
        notify.error(notifyConnectionFailedX(result.message));
      }
      return result.success;
    } catch (error) {
      setSites(prev => {
        const finalUpdated = prev.map(s =>
          s.id === site.id ? { ...s, connectionStatus: 'failed' as const, lastTested: Date.now() } : s
        );
        saveSites(finalUpdated);
        return finalUpdated;
      });
      notify.error(error instanceof Error ? error.message : "Connection test failed");
      return false;
    } finally {
      setIsTesting(null);
    }
  }, []);

  const handleDetectSitemaps = useCallback(async (site: WordPressSite) => {
    setIsDetecting(site.id);

    try {
      const result = await detectSitemaps(
        site.siteUrl,
        site.username,
        site.appPassword
      );

      if (result.found && result.sitemapUrl) {
        // Parse the sitemap
        try {
          const parseResult = await parseSitemap(
            site.siteUrl,
            result.sitemapUrl,
            site.username,
            site.appPassword
          );

          // NEVER save wp-sitemap.xml - convert to sitemap_index.xml if detected
          let sitemapUrl = result.sitemapUrl!;
          if (sitemapUrl.includes('/wp-sitemap.xml')) {
            console.warn('[WordPress] Rejecting wp-sitemap.xml, converting to sitemap_index.xml');
            sitemapUrl = sitemapUrl.replace('/wp-sitemap.xml', '/sitemap_index.xml');
          }

          // Extract endpoints from child sitemap URLs
          const sitemapEndpoints: Record<string, string> = {};
          if (parseResult.childSitemaps && parseResult.childSitemaps.length > 0) {
            for (const childSitemapUrl of parseResult.childSitemaps) {
              try {
                // Extract endpoint from sitemap URL (e.g., "service-areas-sitemap.xml" -> "service-areas")
                const sitemapFilename = childSitemapUrl.split('/').pop() || '';
                const endpoint = sitemapFilename.replace(/[-_]sitemap\.xml$/i, '');
                if (endpoint && endpoint.length > 0) {
                  sitemapEndpoints[childSitemapUrl] = endpoint;
                  console.log(`[WordPress] Detected endpoint for ${childSitemapUrl}: ${endpoint}`);
                }
              } catch (error) {
                console.warn(`[WordPress] Failed to extract endpoint from ${childSitemapUrl}:`, error);
              }
            }
          }

          let mergedSitemapData: NonNullable<WordPressSite["sitemaps"]>;
          setSites((prevSites) => {
            const prevSite = prevSites.find((x) => x.id === site.id);
            const prevDisabled = prevSite?.sitemaps?.disabledChildSitemapUrls ?? [];
            const nextChildren = parseResult.childSitemaps ?? [];
            const keptDisabled = prevDisabled.filter((u) => nextChildren.includes(u));
            mergedSitemapData = {
              mainSitemapUrl: sitemapUrl,
              detectedAt: Date.now(),
              type: result.type || parseResult.type,
              childSitemaps: parseResult.childSitemaps,
              urls: parseResult.urls,
              endpoints: sitemapEndpoints,
              ...(keptDisabled.length > 0
                ? { disabledChildSitemapUrls: keptDisabled }
                : {}),
            };
            const updated = prevSites.map((s) =>
              s.id === site.id ? { ...s, sitemaps: mergedSitemapData } : s,
            );
            saveSites(updated);
            return updated;
          });
          notify.success(notifySitemapDetectedX(result.sitemapUrl));
          
          // Show endpoint detection summary
          const endpointCount = Object.keys(sitemapEndpoints).length;
          if (endpointCount > 0) {
            const endpointsList = Object.values(sitemapEndpoints).join(', ');
            console.log(`[WordPress] Detected ${endpointCount} endpoints: ${endpointsList}`);
            notify.info(notifyDetectedXEndpointSX(endpointCount, endpointsList));
          }
          
          // Auto-detect entity sitemap after sitemap detection
          const updatedSite: WordPressSite = { ...site, sitemaps: mergedSitemapData };
          let detectedEntitySitemapUrl: string | undefined;
          try {
            console.log('[WordPress] Auto-detecting entity sitemap...');
            const detectedEntitySitemap = await detectEntitySitemap(updatedSite);
            if (detectedEntitySitemap) {
              detectedEntitySitemapUrl = detectedEntitySitemap;
              setSites(prevSites => {
                const sitesWithEntity = prevSites.map(s =>
                  s.id === site.id ? { ...s, entitySitemapUrl: detectedEntitySitemap } : s
                );
                saveSites(sitesWithEntity);
                return sitesWithEntity;
              });
              console.log(`[WordPress] Auto-detected entity sitemap: ${detectedEntitySitemap}`);
              notify.success(notifyEntitySitemapAutoDetectedX(detectedEntitySitemap.split('/').pop()));
            }
          } catch (error) {
            console.warn('[WordPress] Error auto-detecting entity sitemap:', error);
            // Don't fail the whole process if entity detection fails
          }

          const siteForSilentNap: WordPressSite = {
            ...site,
            sitemaps: mergedSitemapData,
            entitySitemapUrl: detectedEntitySitemapUrl ?? site.entitySitemapUrl,
          };
          console.log('[NAP] Running silent NAP after sitemap detection', {
            siteId: site.id,
            hasMainSitemap: Boolean(siteForSilentNap.sitemaps?.mainSitemapUrl),
            entitySitemapUrl: siteForSilentNap.entitySitemapUrl,
          });
          void extractNAPAndSaveToSiteSilent(siteForSilentNap);
          
          // Auto-fetch scheduled posts after sitemap detection
          setIsFetchingScheduled(site.id);
          try {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            const scheduledResult = await getScheduledPosts(
              site.siteUrl,
              site.username,
              site.appPassword,
              currentMonth,
              currentYear
            );

            console.log('[WordPress] Scheduled posts result:', scheduledResult);

            if (!scheduledResult.error) {
              // Use functional update to ensure we have the latest state
              setSites(prevSites => {
                const updatedWithScheduled = prevSites.map(s => {
                  if (s.id === site.id) {
                    return {
                      ...s,
                      scheduledPosts: {
                        count: scheduledResult.count || 0,
                        month: currentMonth,
                        year: currentYear,
                        fetchedAt: Date.now(),
                      },
                    };
                  }
                  return s;
                });
                saveSites(updatedWithScheduled);
                return updatedWithScheduled;
              });
              
              if (scheduledResult.debug) {
                console.log('[WordPress] Debug info:', scheduledResult.debug);
                if (scheduledResult.debug.totalScheduledPosts > 0 && scheduledResult.count === 0) {
                  console.warn(`[WordPress] Found ${scheduledResult.debug.totalScheduledPosts} scheduled posts total, but 0 for current month ${currentMonth + 1}/${currentYear}`);
                }
              }
            } else {
              // Still update with 0 count if there's an error, so user knows we tried
              setSites(prevSites => {
                const updatedWithScheduled = prevSites.map(s => {
                  if (s.id === site.id) {
                    return {
                      ...s,
                      scheduledPosts: {
                        count: 0,
                        month: currentMonth,
                        year: currentYear,
                        fetchedAt: Date.now(),
                      },
                    };
                  }
                  return s;
                });
                saveSites(updatedWithScheduled);
                return updatedWithScheduled;
              });
            }
          } catch (scheduledError) {
            // Update with 0 count on error so UI shows we attempted to fetch
            console.error('[WordPress] Error fetching scheduled posts:', scheduledError);
            setSites(prevSites => {
              const now = new Date();
              const updatedWithScheduled = prevSites.map(s => {
                if (s.id === site.id) {
                  return {
                    ...s,
                    scheduledPosts: {
                      count: 0,
                      month: now.getMonth(),
                      year: now.getFullYear(),
                      fetchedAt: Date.now(),
                    },
                  };
                }
                return s;
              });
              saveSites(updatedWithScheduled);
              return updatedWithScheduled;
            });
          } finally {
            setIsFetchingScheduled(null);
          }
        } catch (parseError) {
          notify.error(parseError instanceof Error ? parseError.message : "Failed to parse sitemap");
        }
      } else {
        notify.error(result.message || "No sitemap found");
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to detect sitemaps");
    } finally {
      setIsDetecting(null);
    }
  }, []);

  const runAutoSetupForNewSite = useCallback(async (site: WordPressSite) => {
    const success = await handleTestConnection(site);
    if (success) {
      await handleDetectSitemaps(site);
    }
  }, [handleTestConnection, handleDetectSitemaps]);

  const handleSaveSite = useCallback((
    formName: string,
    formSiteUrl: string,
    formUsername: string,
    formAppPassword: string,
    editingSite: WordPressSite | null,
    formProductionSiteUrl?: string,
    formGa4PropertyId?: string,
    formGbpLocationId?: string,
    formSemrushSiteAuditProjectId?: string,
    formEditorialCountsPeriodStartYmd?: string,
    formOptimizationPackage?: string,
    formBenchmarkCustomTag?: string,
  ): WordPressSite | false => {
    if (!formName.trim()) {
      notify.error(NOTIFY_ENTER_A_SITE_NAME);
      return false;
    }

    const siteUrl = formSiteUrl.trim() || formProductionSiteUrl?.trim() || "";
    const username = formUsername.trim() || editingSite?.username || "";
    const appPassword = formAppPassword.trim() || editingSite?.appPassword || "";

    const base = editingSite ? { ...editingSite } : {};
    const rawOptPkg = (formOptimizationPackage ?? "").trim();
    const optimizationPackage: "basic" | "pro" | "plus" | undefined =
      rawOptPkg && isOptimizationPackageTier(rawOptPkg) ? rawOptPkg : undefined;
    const siteData: WordPressSite = {
      ...base,
      id: editingSite?.id || `wp-${Date.now()}`,
      name: formName.trim(),
      siteUrl,
      productionSiteUrl: formProductionSiteUrl?.trim() || undefined,
      username,
      appPassword,
      connectedAt: editingSite?.connectedAt || Date.now(),
      lastTested: editingSite?.lastTested,
      connectionStatus: editingSite?.connectionStatus,
      enabled: editingSite?.enabled !== undefined ? editingSite.enabled : true,
      sitemaps: editingSite?.sitemaps,
      ga4PropertyId: formGa4PropertyId?.trim() || undefined,
      gbpLocationId: formGbpLocationId?.trim() || undefined,
      semrushSiteAuditProjectId: formSemrushSiteAuditProjectId?.trim() || undefined,
      editorialCountsPeriodStartYmd: formEditorialCountsPeriodStartYmd?.trim() || undefined,
      optimizationPackage,
      benchmarkCustomTag: formBenchmarkCustomTag?.trim() || undefined,
      postBankEnabled: true,
    };

    invalidateEntitySiteWarmCacheIfCredentialsChanged(siteData);

    const updated = editingSite
      ? sites.map(s => s.id === editingSite.id ? siteData : s)
      : [...sites, siteData];

    setSites(updated);
    saveSites(updated);
    notify.success(editingSite ? "Site updated" : "Site added");

    if (!editingSite && siteUrl && username && appPassword) {
      runAutoSetupForNewSite(siteData);
    } else if (canWarmEntitySite(siteData)) {
      warmEntitySiteCache(siteData);
    }
    return siteData;
  }, [sites, runAutoSetupForNewSite]);

  const handleSaveSitesBulk = useCallback((
    clients: Array<{ name: string; siteUrl: string; username: string; appPassword: string }>
  ) => {
    if (clients.length === 0) return;
    const baseId = Date.now();
    const newSites: WordPressSite[] = clients.map((c, i) => ({
      id: `wp-${baseId}-${i}`,
      name: c.name.trim(),
      siteUrl: c.siteUrl.trim(),
      username: c.username.trim(),
      appPassword: c.appPassword.trim(),
      connectedAt: Date.now(),
      enabled: true,
      postBankEnabled: true,
    }));
    const updated = [...sites, ...newSites];
    setSites(updated);
    saveSites(updated);
    Promise.all(newSites.map((site) => runAutoSetupForNewSite(site)));
  }, [sites, runAutoSetupForNewSite]);

  const handleFetchScheduledPosts = useCallback(async (site: WordPressSite) => {
    setIsFetchingScheduled(site.id);

    try {
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();

      const result = await getScheduledPosts(
        site.siteUrl,
        site.username,
        site.appPassword,
        currentMonth,
        currentYear
      );

      if (result.error) {
        notify.error(notifyFailedToFetchScheduledPostsX(result.error));
        return;
      }

      const updated = sites.map(s => {
        if (s.id === site.id) {
          return {
            ...s,
            scheduledPosts: {
              count: result.count,
              month: currentMonth,
              year: currentYear,
              fetchedAt: Date.now(),
            },
          };
        }
        return s;
      });

      setSites(updated);
      saveSites(updated);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to fetch scheduled posts");
    } finally {
      setIsFetchingScheduled(null);
    }
  }, [sites]);

  const getScrapingKey = (siteId: string, sitemapUrl: string): string => {
    return `${siteId}:${sitemapUrl}`;
  };

  const handleScrapeChildSitemap = useCallback(async (site: WordPressSite, childSitemapUrl: string) => {
    if (!site.sitemaps) {
      notify.error(NOTIFY_PLEASE_DETECT_SITEMAPS_FIRST_BEFORE_SCRA);
      return;
    }

    const scrapingKey = getScrapingKey(site.id, childSitemapUrl);
    setIsScrapingSitemap(prev => ({
      ...prev,
      [scrapingKey]: true
    }));

    try {
      await scrapeChildSitemap(site, childSitemapUrl, (message) => {
        notify.info(message);
      });
      setSites(getStoredSites());
    } catch (error) {
      console.error('Error scraping child sitemap:', error);
      notify.error(error instanceof Error ? error.message : `Failed to scrape sitemap: ${childSitemapUrl}`);
    } finally {
      setIsScrapingSitemap(prev => {
        const updated = { ...prev };
        delete updated[scrapingKey];
        return updated;
      });
    }
  }, []);

  const handleIndexSitemap = useCallback(async (site: WordPressSite, sitemapUrl: string) => {
    const indexingKey = `${site.id}-${sitemapUrl}`;
    
    setIsIndexingSitemap(prev => ({
      ...prev,
      [indexingKey]: true
    }));

    // Show initial progress toast
    const progressToastId = notify.loading(NOTIFY_INDEXING_SITEMAP);

    try {
      const result = await indexSitemapUrls(
        site.siteUrl,
        sitemapUrl,
        site.username,
        site.appPassword,
        (progress: IndexingProgress) => {
          // Update progress toast
          notify.loading(
            `Indexing ${progress.processed}/${progress.total} (${progress.indexed} ok, ${progress.errors} err)`,
            { id: progressToastId },
          );
        }
      );

      if (result.success) {
        // Dismiss progress toast and show success
        notify.dismiss(progressToastId);
        notify.success(notifyIndexingDoneXIndexedXErr(result.indexed, result.errors), {
          duration: 8000,
        });
      } else {
        notify.dismiss(progressToastId);
        notify.error(
          `Indexing failed: ${result.error || 'Unknown error'}`,
          { duration: 6000 }
        );
      }
    } catch (error) {
      console.error('Error indexing sitemap:', error);
      notify.dismiss(progressToastId);
      
      const errorMessage = error instanceof Error ? error.message : `Failed to index sitemap: ${sitemapUrl}`;
      
      // Check for specific error types
      if (errorMessage.includes('sitemap index')) {
        notify.error(
          'This sitemap is an index (contains other sitemaps). Please process individual child sitemaps instead.',
          { duration: 6000 }
        );
      } else if (errorMessage.includes('No URLs found')) {
        notify.error(
          'No URLs found in this sitemap. Please check the sitemap URL.',
          { duration: 6000 }
        );
      } else {
        notifyHeaderError("WordPress site error", errorMessage, { duration: 6000 });
      }
    } finally {
      setIsIndexingSitemap(prev => {
        const updated = { ...prev };
        delete updated[indexingKey];
        return updated;
      });
    }
  }, []);

  const handleLoadCalendarPosts = useCallback(async (site: WordPressSite, childSitemapUrl: string) => {
    if (!site.sitemaps) {
      notify.error(NOTIFY_PLEASE_DETECT_SITEMAPS_FIRST);
      return;
    }

    const loadingKey = `${site.id}-${childSitemapUrl}`;
    setIsLoadingCalendar(prev => ({
      ...prev,
      [loadingKey]: true
    }));

    try {
      // Parse sitemap to get URLs
      const parseResult = await parseSitemap(
        site.siteUrl,
        childSitemapUrl,
        site.username,
        site.appPassword
      );

      if (!parseResult.urls || parseResult.urls.length === 0) {
        notify.error(NOTIFY_NO_URLS_FOUND_IN_SITEMAP);
        return;
      }

      notify.info(notifyLoadingXPostsFromSitemap(parseResult.urls.length));

      // Resolve URLs to WordPress posts
      const resolveResult = await resolveWordPressUrls(
        site.siteUrl,
        site.username,
        site.appPassword,
        parseResult.urls
      );

      if (!resolveResult.resolved || resolveResult.resolved.length === 0) {
        notify.error(NOTIFY_COULD_NOT_RESOLVE_ANY_URLS_TO_WORDPRESS_);
        return;
      }

      // Fetch post content with dates
      const resolvedObjects = resolveResult.resolved.map(r => ({ id: r.id, subtype: r.subtype }));
      const postContentResult = await getWordPressPostContent(
        site.siteUrl,
        site.username,
        site.appPassword,
        undefined,
        undefined,
        resolvedObjects
      );

      if (postContentResult.posts && postContentResult.posts.length > 0) {
        const now = new Date();
        const postsMetadata = postContentResult.posts.map(post => {
          // Use status from API if available, otherwise determine from date
          let status = post.status || 'publish';
          if (!post.status && post.date_gmt) {
            try {
              const postDate = new Date(post.date_gmt);
              if (postDate > now) {
                status = 'future';
              }
            } catch (e) {
              // Keep default status if date parsing fails
            }
          }
          
          return {
            id: post.id,
            slug: post.slug,
            title: post.title,
            date_gmt: post.date_gmt || '',
            status: status,
            link: post.link,
          };
        });

        // Count future posts
        const futureCount = postsMetadata.filter(post => {
          if (post.status === 'future') return true;
          if (!post.date_gmt) return false;
          try {
            const postDate = new Date(post.date_gmt);
            return postDate > now;
          } catch {
            return false;
          }
        }).length;

        // Update site data with post metadata using functional update to ensure latest state
        setSites(prevSites => {
          const updated = prevSites.map(s => {
            if (s.id === site.id && s.sitemaps) {
              return {
                ...s,
                sitemaps: {
                  ...s.sitemaps,
                  postMetadata: {
                    ...(s.sitemaps.postMetadata || {}),
                    [childSitemapUrl]: {
                      posts: postsMetadata,
                      futureCount,
                      lastChecked: Date.now(),
                    },
                  },
                },
              };
            }
            return s;
          });
          saveSites(updated);
          return updated;
        });
        
        notify.success(notifyLoadedXPostsWithDatesXFuture(postsMetadata.length, futureCount));
      } else {
        notify.error(NOTIFY_NO_POSTS_FOUND);
      }
    } catch (error) {
      console.error('Error loading calendar posts:', error);
      notify.error(error instanceof Error ? error.message : `Failed to load posts: ${childSitemapUrl}`);
    } finally {
      setIsLoadingCalendar(prev => {
        const updated = { ...prev };
        delete updated[loadingKey];
        return updated;
      });
    }
  }, [sites]);

  const handleCheckFuturePosts = useCallback(async (site: WordPressSite, childSitemapUrl: string) => {
    if (!site.sitemaps) {
      notify.error(NOTIFY_PLEASE_DETECT_SITEMAPS_FIRST);
      return;
    }

    const checkingKey = `${site.id}-${childSitemapUrl}`;
    setIsCheckingFuture(prev => ({
      ...prev,
      [checkingKey]: true
    }));

    try {
      const result = await checkFuturePosts(
        site.siteUrl,
        site.username,
        site.appPassword,
        childSitemapUrl
      );

      if (result.success) {
        // Update site data with future posts metadata
        const updated = sites.map(s => {
          if (s.id === site.id && s.sitemaps) {
            const existingMetadata = s.sitemaps.postMetadata?.[childSitemapUrl];
            const updatedMetadata = {
              ...(existingMetadata || { posts: [], futureCount: 0, lastChecked: 0 }),
              futureCount: result.futureCount,
              lastChecked: Date.now(),
              // Update posts with future status if we have them
              posts: result.posts ? result.posts.map(p => ({
                ...p,
                status: p.status || (new Date(p.date_gmt) > new Date() ? 'future' : 'publish')
              })) : (existingMetadata?.posts || []),
            };

            return {
              ...s,
              sitemaps: {
                ...s.sitemaps,
                postMetadata: {
                  ...(s.sitemaps.postMetadata || {}),
                  [childSitemapUrl]: updatedMetadata,
                },
              },
            };
          }
          return s;
        });

        setSites(updated);
        saveSites(updated);
        notify.success(notifyFoundXFuturePostxInSitemap(result.futureCount, result.futureCount !== 1 ? 's' : ''));
      } else {
        notify.error(result.error || "Failed to check future posts");
      }
    } catch (error) {
      console.error('Error checking future posts:', error);
      notify.error(error instanceof Error ? error.message : `Failed to check future posts: ${childSitemapUrl}`);
    } finally {
      setIsCheckingFuture(prev => {
        const updated = { ...prev };
        delete updated[checkingKey];
        return updated;
      });
    }
  }, [sites]);

  const handleSetEntitySitemap = useCallback((site: WordPressSite, sitemapUrl: string) => {
    const trimmed = sitemapUrl.trim();
    const clearing =
      !trimmed || site.entitySitemapUrl?.trim() === trimmed;
    const updated = sites.map((s) => {
      if (s.id !== site.id) return s;
      if (clearing) {
        return { ...s, entitySitemapUrl: undefined };
      }
      return {
        ...s,
        entitySitemapUrl: trimmed,
        ...(s.sitemaps
          ? { sitemaps: { ...s.sitemaps, detectedAt: Date.now() } }
          : {}),
      };
    });
    setSites(updated);
    saveSites(updated);
    if (clearing) {
      notify.info(NOTIFY_ENTITY_SITEMAP_CLEARED);
    } else {
      const tail = trimmed.split("/").pop() ?? trimmed;
      notify.success(notifyEntitySitemapSetToX(tail));
    }
  }, [sites]);

  const handleToggleChildSitemapDisabled = useCallback(
    (site: WordPressSite, childUrl: string) => {
      const prevSite = sites.find((s) => s.id === site.id);
      const children = prevSite?.sitemaps?.childSitemaps;
      if (!children?.includes(childUrl)) return;

      const entityUrl = prevSite?.entitySitemapUrl?.trim();
      if (entityUrl && entityUrl === childUrl.trim()) {
        notify.error(NOTIFY_CLEAR_ENTITY_SITEMAP_IN_THE_SITEMAP_MENU);
        return;
      }

      const current = prevSite.sitemaps?.disabledChildSitemapUrls ?? [];
      const wasDisabled = current.includes(childUrl);
      const nextDisabled = wasDisabled
        ? current.filter((u) => u !== childUrl)
        : [...current, childUrl];

      const updated = sites.map((s) => {
        if (s.id !== site.id || !s.sitemaps) return s;
        if (!s.sitemaps.childSitemaps?.includes(childUrl)) return s;
        const nextSitemaps = { ...s.sitemaps };
        if (nextDisabled.length > 0) {
          nextSitemaps.disabledChildSitemapUrls = nextDisabled;
        } else {
          delete nextSitemaps.disabledChildSitemapUrls;
        }
        return {
          ...s,
          sitemaps: nextSitemaps,
        };
      });
      setSites(updated);
      saveSites(updated);
      if (wasDisabled) {
        notify.success(NOTIFY_SITEMAP_INCLUDED_FOR_THIS_PROPERTY);
      } else {
        notify.info(NOTIFY_SITEMAP_EXCLUDED_FOR_THIS_PROPERTY);
      }
    },
    [sites],
  );

  const handlePatchSite = useCallback((siteId: string, patch: Partial<WordPressSite>) => {
    setSites((prev) => {
      const updated = prev.map((s) => (s.id === siteId ? { ...s, ...patch } : s));
      saveSites(updated);
      return updated;
    });
  }, []);

  const handleAppendManualChildSitemap = useCallback((site: WordPressSite, rawUrl: string) => {
    const url = rawUrl.trim();
    if (!url) return;

    setSites((prev) => {
      let outcome: "added" | "duplicate" | "noop" = "noop";
      const updated = prev.map((s) => {
        if (s.id !== site.id || !s.sitemaps) return s;
        if (s.sitemaps.type === "index") {
          const existing = s.sitemaps.childSitemaps ?? [];
          if (existing.includes(url)) {
            outcome = "duplicate";
            return s;
          }
          outcome = "added";
          return {
            ...s,
            sitemaps: {
              ...s.sitemaps,
              childSitemaps: [...existing, url],
            },
          };
        }
        if (s.sitemaps.type === "urlset") {
          const existing = s.sitemaps.urls ?? [];
          if (existing.includes(url)) {
            outcome = "duplicate";
            return s;
          }
          outcome = "added";
          return {
            ...s,
            sitemaps: {
              ...s.sitemaps,
              urls: [...existing, url],
            },
          };
        }
        return s;
      });
      if (outcome === "added") {
        saveSites(updated);
        notify.success(NOTIFY_SITEMAP_ADDED);
      } else if (outcome === "duplicate") {
        notify.info(NOTIFY_ALREADY_IN_LIST);
      }
      return updated;
    });
  }, []);

  return {
    sites: sitesSortedByName,
    setSites,
    isTesting,
    isDetecting,
    isFetchingScheduled,
    isScrapingSitemap,
    isIndexingSitemap,
    isCheckingFuture,
    isLoadingCalendar,
    handleAddSite,
    handleEditSite,
    handleDeleteSite,
    handleDeleteSitesBulk,
    handleToggleEnabled,
    handleConnectSite,
    handleSaveSite,
    handleSaveSitesBulk,
    handleTestConnection,
    handleDetectSitemaps,
    handleFetchScheduledPosts,
    handleScrapeChildSitemap,
    handleIndexSitemap,
    handleCheckFuturePosts,
    handleLoadCalendarPosts,
    handleSetEntitySitemap,
    handleToggleChildSitemapDisabled,
    handlePatchSite,
    handleAppendManualChildSitemap,
    getScrapingKey,
  };
}

const WordPressSitesContext = createContext<ReturnType<typeof useWordPressSitesState> | null>(null);

export function WordPressSitesProvider({ children }: { children: ReactNode }) {
  const value = useWordPressSitesState();
  return createElement(WordPressSitesContext.Provider, { value }, children);
}

export function useWordPressSites(): ReturnType<typeof useWordPressSitesState> {
  const ctx = useContext(WordPressSitesContext);
  if (!ctx) {
    throw new Error("useWordPressSites must be used within WordPressSitesProvider");
  }
  return ctx;
}
