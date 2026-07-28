import React, { useState, useRef } from "react";
import { 
  TestTube, 
  Map, 
  Network,
  Loader2,
  Database,
  CheckCircle2,
  XCircle,
  BarChart3,
  Building2,
  Download,
} from "lucide-react";
import { type WordPressSite, KB_FILES_STORAGE_KEY, type StoredFile } from "../types";
import { getCyberpunkTextClasses } from "./cyberpunk-theme";
import { notify, notifyHeaderError } from "@/lib/app-notifications";
import { NOTIFY_ADD_GA4_PROPERTY_ID_FOR_THIS_SITE_CLICK_, NOTIFY_ENTITY_POST_CREATED_DATE_MODIFIER, NOTIFY_GMB_STATS_ADDED_TO_KNOWLEDGE_BASE, NOTIFY_NO_GMB_PERFORMANCE_DATA_RETURNED, NOTIFY_POST_CREATED_NO_DATE_MODIFIER, notifyAcfRestFailedX, notifyEntityPostFailedX, notifyGmbStatsSavedButApiReportedXUseL } from "@/lib/notify-messages";
import { extractEndpointFromEntitySitemapUrl } from "@/lib/entity-endpoint-extractor";
import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";
import { getGMBPullDateRanges } from "@/lib/gmb-date-helpers";
import { loadApiKey } from "@/lib/api";
import { resolveRecommendedAuthor } from "@/lib/wordpress-api/author-resolver";
import { cn } from "@/lib/utils";

interface ACFTestResult {
  success: boolean;
  hasAcfSupport?: boolean;
  acfFields?: Record<string, unknown>;
  error?: string;
  requiredConfig?: { php: string[] };
}

interface WordPressCardActionsProps {
  site: WordPressSite;
  isTesting: boolean;
  isDetecting: boolean;
  isExtractingNAPAndGraph: boolean;
  onTest: () => void;
  onDetect: () => void;
  onExtractNAPAndGraph?: () => void;
  onPatchSite?: (siteId: string, patch: Partial<WordPressSite>) => void;
  /** Embedded property panel on black: white labels, flat section chrome. */
  tone?: "card" | "propertyBlack";
}

export const WordPressCardActions: React.FC<WordPressCardActionsProps> = ({
  site,
  isTesting,
  isDetecting,
  isExtractingNAPAndGraph,
  onTest,
  onDetect,
  onExtractNAPAndGraph,
  onPatchSite,
  tone = "card",
}) => {
  const isPropertyBlack = tone === "propertyBlack";
  const isDisabled = site.enabled === false;
  const [isTestingACF, setIsTestingACF] = useState(false);
  const [isTestingGA, setIsTestingGA] = useState(false);
  const [isTestingGMB, setIsTestingGMB] = useState(false);
  const [isPullingGMBStats, setIsPullingGMBStats] = useState(false);
  const pullGMBInProgressRef = useRef(false);
  const [acfTestResult, setAcfTestResult] = useState<ACFTestResult & { dateModifierSet?: boolean; postId?: number; postUrl?: string } | null>(null);

  const handlePullGMBStats = async () => {
    if (pullGMBInProgressRef.current) return;
    pullGMBInProgressRef.current = true;
    const dates = getGMBPullDateRanges(); // current period end capped at today-3d for API data lag
    const body = { ...dates } as Record<string, unknown>;
    if (site.gbpLocationId?.trim()) {
      body.locationIds = [site.gbpLocationId.trim()];
    }
    setIsPullingGMBStats(true);
    try {
      const response = await fetch(`${BACKEND_API_BASE}/api/gmb/performance`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        notify.error(data?.error ?? response.statusText ?? "Failed to pull GMB stats");
        return;
      }
      if (!data.success || !data.currentPeriod) {
        notify.error(NOTIFY_NO_GMB_PERFORMANCE_DATA_RETURNED);
        return;
      }
      const cur = data.currentPeriod;
      const comp = data.comparisonPeriod;
      const apiWarning = data.apiWarning;
      const curTotal = (cur.calls ?? 0) + (cur.directions ?? 0) + (cur.websiteClicks ?? 0);
      const compTotal = (comp?.calls ?? 0) + (comp?.directions ?? 0) + (comp?.websiteClicks ?? 0);
      const allZero = curTotal === 0 && compTotal === 0;
      let footnote = "";
      if (apiWarning) footnote += `\n\n**API note:** ${apiWarning}\n`;
      if (allZero && !apiWarning) footnote += "\n\n*All metrics are 0 for these periods (no recorded activity in GBP for these dates, or data not yet available).*\n";
      const content = `# Google Business Profile – Performance snapshot
Pulled: ${new Date().toISOString().slice(0, 19)}Z | Locations: ${data.locationCount ?? 0}

## Current period (${cur.startDate} – ${cur.endDate})
| Metric | Count |
| --- | --- |
| Call clicks | ${cur.calls?.toLocaleString() ?? 0} |
| Direction requests | ${cur.directions?.toLocaleString() ?? 0} |
| Website clicks | ${cur.websiteClicks?.toLocaleString() ?? 0} |

## Comparison period (${comp?.startDate} – ${comp?.endDate})
| Metric | Count |
| --- | --- |
| Call clicks | ${comp?.calls?.toLocaleString() ?? 0} |
| Direction requests | ${comp?.directions?.toLocaleString() ?? 0} |
| Website clicks | ${comp?.websiteClicks?.toLocaleString() ?? 0} |
${footnote}`;
      const timestamp = Date.now();
      const newFile: StoredFile = {
        name: `gmb-stats-${timestamp}.md`,
        size: content.length,
        content,
        starred: false,
        timestamp,
      };
      const stored = localStorage.getItem(KB_FILES_STORAGE_KEY) || "[]";
      const files: StoredFile[] = JSON.parse(stored);
      localStorage.setItem(KB_FILES_STORAGE_KEY, JSON.stringify([...files, newFile]));
      window.dispatchEvent(new CustomEvent("kb-files-updated", { detail: { files: [...files, newFile] } }));
      if (apiWarning) notify.warning(notifyGmbStatsSavedButApiReportedXUseL(apiWarning));
      else notify.success(NOTIFY_GMB_STATS_ADDED_TO_KNOWLEDGE_BASE);
    } catch (err) {
      notifyHeaderError("GMB stats pull failed", err);
    } finally {
      pullGMBInProgressRef.current = false;
      setIsPullingGMBStats(false);
    }
  };

  const handleTestGMB = async () => {
    setIsTestingGMB(true);
    try {
      const response = await fetch(`${BACKEND_API_BASE}/api/gmb/test`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        notify.success(data.message || "Google Business Profile connection OK");
      } else {
        notify.error(data.error || response.statusText || "GMB test failed");
      }
    } catch (err) {
      notifyHeaderError("GMB test failed", err);
    } finally {
      setIsTestingGMB(false);
    }
  };

  const handleTestGA = async () => {
    const propertyId = site.ga4PropertyId?.trim() ?? "";
    if (!propertyId) {
      notify.error(NOTIFY_ADD_GA4_PROPERTY_ID_FOR_THIS_SITE_CLICK_);
      return;
    }
    setIsTestingGA(true);
    try {
      const response = await fetch(`${BACKEND_API_BASE}/api/ga/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        notify.success(data.message || "Google Analytics connection OK");
      } else {
        notify.error(data.error || response.statusText || "Google Analytics test failed");
      }
    } catch (err) {
      notifyHeaderError("Google Analytics test failed", err);
    } finally {
      setIsTestingGA(false);
    }
  };

  const handleTestACFRest = async () => {
    setIsTestingACF(true);
    setAcfTestResult(null);
    
        
    try {
      // Use entity sitemap URL to determine the correct endpoint
      let testPostType = 'post';
      let testEndpoint = 'posts';
      
      // Priority: Use entitySitemapUrl if available (this is the entity/CPT endpoint)
      if (site.entitySitemapUrl) {
        testEndpoint = extractEndpointFromEntitySitemapUrl(site.entitySitemapUrl);
        testPostType = testEndpoint; // For CPTs, type and endpoint are usually the same
                console.log('[ACF Test] Using entity endpoint from entitySitemapUrl:', testEndpoint);
      }
      
      // CREATE A NEW POST with date_modifier set to today - skip validation, just do it
      let dateModifierSet = false;
      let newPostId: number | undefined;
      let postUrl: string | undefined;
      let createError: string | undefined;
      const today = new Date().toISOString().split('T')[0]; // "2026-01-19"
      
      console.log('[ACF Test] Creating new entity post with endpoint:', testEndpoint);

      let authorId: number | undefined;
      try {
        authorId = await resolveRecommendedAuthor({
          site,
          postTypeEndpoint: testEndpoint,
          apiKey: loadApiKey(),
          siteId: site.id,
        });
      } catch {
        authorId = undefined;
      }
      
      try {
        const requestBody: Record<string, unknown> = {
          siteUrl: site.siteUrl,
          username: site.username,
          appPassword: site.appPassword,
          title: `ACF Test - ${today}`,
          content: `<p>Test post created to verify ACF REST API. Date modifier: ${today}</p>`,
          status: 'draft',
          postType: testPostType,
          postTypeEndpoint: testEndpoint
        };
        if (authorId != null) requestBody.author = authorId;
        
                
        // Create a new post in the entity CPT (use BACKEND_API_BASE for Render/cross-origin)
        const createResponse = await fetch(`${BACKEND_API_BASE}/api/wordpress/create-post`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        const createText = await createResponse.text();
        let createData: { success?: boolean; postId?: number; id?: number; link?: string; url?: string; error?: string };
        try {
          createData = createText ? JSON.parse(createText) : {};
        } catch {
          throw new Error(
            `Server returned invalid JSON. Status: ${createResponse.status}. ` +
            `Ensure VITE_MCP_API_BASE points to your backend on Render. Body: ${createText.slice(0, 150) || "empty"}`
          );
        }
        
                
        console.log('[ACF Test] Create response:', createData);
        console.log('[ACF Test] Request was:', {
          siteUrl: site.siteUrl,
          postType: testPostType,
          postTypeEndpoint: testEndpoint,
          entitySitemapUrl: site.entitySitemapUrl
        });
        
        if (createData.success && (createData.postId || createData.id)) {
          newPostId = createData.postId || createData.id;
          postUrl = createData.link || createData.url;
                    
          // Now set the date_modifier ACF field on the new post
                    
          const acfUpdateResponse = await fetch(`${BACKEND_API_BASE}/api/wordpress/update-acf-fields`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              siteUrl: site.siteUrl,
              username: site.username,
              appPassword: site.appPassword,
              postId: newPostId,
              postType: testPostType,
              postTypeEndpoint: testEndpoint,
              fields: {
                date_modifier: today
              },
              options: {
                verifyAfterUpdate: true
              }
            })
          });

          const acfUpdateText = await acfUpdateResponse.text();
          let acfUpdateData: { success?: boolean; error?: string; updated?: unknown; failed?: unknown };
          try {
            acfUpdateData = acfUpdateText ? JSON.parse(acfUpdateText) : {};
          } catch {
            throw new Error(
              `ACF update returned invalid JSON. Status: ${acfUpdateResponse.status}. ` +
              `Body: ${acfUpdateText.slice(0, 150) || "empty"}`
            );
          }
          
                    
          console.log('[ACF Test] ACF update response:', acfUpdateData);
          dateModifierSet = acfUpdateData.success;
          
          if (dateModifierSet) {
            console.log(`[ACF Test] Created new post ${newPostId} with date_modifier = ${today}`);
          } else {
            console.warn('[ACF Test] Post created but failed to set date_modifier:', acfUpdateData.error || acfUpdateData.failed);
          }
        } else {
          createError = createData.error || 'Failed to create post';
                    console.error('[ACF Test] Failed to create test post:', createError);
        }
      } catch (err) {
        createError = err instanceof Error ? err.message : 'Unknown error';
        console.error('[ACF Test] Error creating test post:', err);
      }
      
      const success = !!newPostId;
      
      setAcfTestResult({
        success,
        hasAcfSupport: success,
        dateModifierSet,
        postId: newPostId,
        postUrl,
        error: createError
      });
      
      if (success) {
        if (dateModifierSet && newPostId) {
          console.log("[ACF Test] date_modifier set", { newPostId, testEndpoint, today });
          notify.success(NOTIFY_ENTITY_POST_CREATED_DATE_MODIFIER);
        } else if (newPostId) {
          console.warn("[ACF Test] date_modifier not set", newPostId);
          notify.warning(NOTIFY_POST_CREATED_NO_DATE_MODIFIER);
        }
      } else {
        const errShort =
          (createError && createError.length > 90)
            ? `${createError.slice(0, 87)}...`
            : createError || "Create failed";
        notify.error(notifyEntityPostFailedX(errShort));
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setAcfTestResult({
        success: false,
        error: errorMsg
      });
      const short =
        errorMsg.length > 100 ? `${errorMsg.slice(0, 97)}...` : errorMsg;
      notify.error(notifyAcfRestFailedX(short));
    } finally {
      setIsTestingACF(false);
    }
  };

  /** Label column in action rows — stays white on black when disabled. */
  const rowLabel = cn("min-w-0 flex-1", isPropertyBlack && "text-white");

  /** Flat action row: fixed icon column; sits in a compact grid cell. */
  const iconSlot = cn(
    "flex shrink-0 items-center justify-center [&>svg]:shrink-0",
    isPropertyBlack
      ? "h-7 w-8 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-white"
      : "h-8 w-9 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-foreground",
  );
  const rowBase = cn(
    "flex w-full max-w-full items-center justify-start gap-0 rounded-md text-left font-medium shadow-none outline-none transition-colors",
    isPropertyBlack
      ? "min-h-8 border-0 bg-transparent px-1.5 py-0.5 text-xs text-white hover:bg-white/[0.08] active:bg-white/[0.1]"
      : "min-h-9 border-0 bg-transparent px-2 py-1 text-xs hover:bg-foreground/[0.07] active:bg-foreground/[0.09] sm:text-sm",
    !isPropertyBlack && "text-foreground",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    isPropertyBlack ? "focus-visible:ring-offset-black" : "focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:hover:bg-transparent",
    isPropertyBlack
      ? "disabled:!opacity-100 disabled:cursor-not-allowed disabled:text-white"
      : "disabled:opacity-50 disabled:hover:bg-transparent",
  );

  const sectionShell = isPropertyBlack
    ? "flex min-h-0 w-full min-w-0 shrink-0 flex-col rounded-lg border border-white/10 bg-white/[0.06] px-3 py-3 shadow-none ring-0 sm:px-4 sm:py-4"
    : "min-w-0 rounded-lg border border-border/50 bg-muted/40 p-2 shadow-none ring-0";

  const sectionTitle = isPropertyBlack
    ? "mb-3 shrink-0 text-[11px] font-semibold tracking-tight text-white [word-spacing:0.2em] sm:mb-4 sm:text-xs"
    : "mb-1.5 text-xs font-semibold tracking-tight text-foreground sm:text-sm";

  const actionGrid =
    "mt-0 grid w-full min-w-0 list-none grid-cols-1 p-0 sm:grid-cols-2 " +
    (isPropertyBlack ? "gap-0 sm:gap-x-0.5 sm:gap-y-0" : "gap-0.5 sm:gap-x-1 sm:gap-y-0.5");

  const actionGridScroll = actionGrid;

  return (
    <div className={cn("mt-2 flex min-h-0 w-full max-w-full flex-col", isPropertyBlack ? "gap-1.5" : "gap-2")}>
      <section aria-labelledby="wp-property-actions-testing" className={sectionShell}>
        <h3 id="wp-property-actions-testing" className={sectionTitle}>
          Testing Connections
        </h3>
        <ul className={actionGridScroll}>
          <li className="min-w-0">
            <button type="button" onClick={onTest} disabled={isTesting || isDisabled} className={rowBase}>
              <span className={iconSlot} aria-hidden>
                {isTesting ? <Loader2 className="animate-spin" /> : <TestTube />}
              </span>
              <span className={rowLabel}>
                {isTesting ? "Testing Connection…" : "Test Connection"}
              </span>
            </button>
          </li>
          <li className="min-w-0">
            <button
              type="button"
              onClick={handleTestACFRest}
              disabled={isTestingACF || isDisabled}
              className={cn(
                rowBase,
                acfTestResult?.success && "bg-green-500/12 hover:bg-green-500/18",
                acfTestResult?.success === false && "bg-red-500/10 hover:bg-red-500/16",
              )}
              title="Test ACF REST API and set date_modifier to today on the first sitemap post"
            >
              <span className={iconSlot} aria-hidden>
                {isTestingACF ? (
                  <Loader2 className="animate-spin" />
                ) : acfTestResult?.success ? (
                  <CheckCircle2 className="text-green-500" />
                ) : acfTestResult?.success === false ? (
                  <XCircle className="text-red-500" />
                ) : (
                  <Database />
                )}
              </span>
              <span className={rowLabel}>
                {isTestingACF
                  ? "Testing ACF REST…"
                  : acfTestResult?.success
                    ? "ACF REST OK"
                    : acfTestResult?.success === false
                      ? "ACF REST Failed"
                      : "Test ACF REST"}
              </span>
            </button>
          </li>
          <li className="min-w-0">
            <button
              type="button"
              onClick={handleTestGMB}
              disabled={isTestingGMB || isDisabled}
              className={rowBase}
              title="Test Google Business Profile connection (connect in Settings first)"
            >
              <span className={iconSlot} aria-hidden>
                {isTestingGMB ? <Loader2 className="animate-spin" /> : <Building2 />}
              </span>
              <span className={rowLabel}>
                {isTestingGMB ? "Testing GMB Connection…" : "Test GMB Connection"}
              </span>
            </button>
          </li>
          <li className="min-w-0">
            <button
              type="button"
              onClick={handleTestGA}
              disabled={isTestingGA || isDisabled}
              className={rowBase}
              title="Test Google Analytics 4 connection (uses GA4 Property ID from Settings)"
            >
              <span className={iconSlot} aria-hidden>
                {isTestingGA ? <Loader2 className="animate-spin" /> : <BarChart3 />}
              </span>
              <span className={rowLabel}>{isTestingGA ? "Testing GA…" : "Test GA"}</span>
            </button>
          </li>
          {onExtractNAPAndGraph ? (
            <li className="min-w-0">
              <button
                type="button"
                onClick={onExtractNAPAndGraph}
                disabled={isExtractingNAPAndGraph || isDisabled}
                className={rowBase}
              >
                <span className={iconSlot} aria-hidden>
                  {isExtractingNAPAndGraph ? <Loader2 className="animate-spin" /> : <Network />}
                </span>
                <span className={rowLabel}>
                  {isExtractingNAPAndGraph ? "Extracting NAP & Graph…" : "Extract NAP & Graph"}
                </span>
              </button>
            </li>
          ) : null}
          <li className="min-w-0">
            <button type="button" onClick={onDetect} disabled={isDetecting || isDisabled} className={rowBase}>
              <span className={iconSlot} aria-hidden>
                {isDetecting ? <Loader2 className="animate-spin" /> : <Map />}
              </span>
              <span className={rowLabel}>{isDetecting ? "Detecting Sitemaps…" : "Detect Sitemaps"}</span>
            </button>
          </li>
          <li className="min-w-0">
            <button
              type="button"
              onClick={handlePullGMBStats}
              disabled={isPullingGMBStats || isDisabled}
              className={rowBase}
              title="Pull GMB stats (this month vs last month) into Knowledge Base"
            >
              <span className={iconSlot} aria-hidden>
                {isPullingGMBStats ? <Loader2 className="animate-spin" /> : <Download />}
              </span>
              <span className={rowLabel}>
                {isPullingGMBStats ? "Pulling GMB Stats…" : "Pull GMB Stats To KB"}
              </span>
            </button>
          </li>
        </ul>
      </section>

      {acfTestResult && (
        <div
          className={cn(
            "rounded-lg p-3 text-sm shadow-none ring-0",
            acfTestResult.success ? "bg-green-500/12" : "bg-red-500/12",
          )}
        >
          {acfTestResult.success ? (
            <div className="space-y-1.5">
              <div className={`font-medium ${getCyberpunkTextClasses("primary")}`}>
                <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                ACF REST API Configured Correctly
              </div>
              {acfTestResult.dateModifierSet && acfTestResult.postId && (
                <div className="text-sm text-green-400">
                  <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                  Set date_modifier to {new Date().toISOString().split("T")[0]} on post {acfTestResult.postId}
                </div>
              )}
              {acfTestResult.postUrl && (
                <div className={getCyberpunkTextClasses("muted")}>
                  <a
                    href={acfTestResult.postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2 hover:text-primary/90"
                  >
                    View Or Edit Post →
                  </a>
                </div>
              )}
              {acfTestResult.acfFields && Object.keys(acfTestResult.acfFields).length > 0 && (
                <div className={getCyberpunkTextClasses("muted")}>
                  <span className="font-medium">Fields Found</span>
                  {": "}
                  {Object.keys(acfTestResult.acfFields).join(", ")}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="font-medium text-red-400">
                <XCircle className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                ACF REST API Not Configured
              </div>
              {acfTestResult.error && <div className="text-red-300/80">{acfTestResult.error}</div>}
              {acfTestResult.requiredConfig?.php && (
                <div className="mt-2">
                  <div className={`mb-1 font-medium ${getCyberpunkTextClasses("secondary")}`}>
                    Add to functions.php
                  </div>
                  <pre className="overflow-x-auto rounded-md bg-muted/50 p-2 text-xs">
                    {acfTestResult.requiredConfig.php.join("\n")}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

