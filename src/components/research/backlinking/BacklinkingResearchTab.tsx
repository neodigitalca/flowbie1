import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, ExternalLink, FileDown, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WorkspaceNestedInput } from "@/components/seo/WorkspaceNestedField";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { BacklinkingWorkspaceHeader } from "@/components/research/backlinking/BacklinkingWorkspaceHeader";
import {
  SEO_WORKSPACE_BODY_SCROLL_CLASS,
  SEO_WORKSPACE_HEADER_CLASS,
  SEO_WORKSPACE_SHELL_CLASS,
} from "@/components/seo/seo-workspace-layout";
import { loadApiKey } from "@/lib/api";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_AI_COULD_NOT_SUGGEST_INDUSTRY_KEYWORDS_F, NOTIFY_ENTER_AN_INDUSTRY_OR_NICHE_KEYWORD, NOTIFY_ENTER_AN_INDUSTRY_OR_RUN_A_SEARCH_FIRST_, NOTIFY_GOOGLE_BUSINESS_PROFILE_REQUEST_RETURNED, NOTIFY_NO_ORGANIC_RESULTS_FOR_THIS_SEARCH_TRY_A, NOTIFY_OPENROUTER_KEY, NOTIFY_SEED_SITE_URL_EXAMPLE, NOTIFY_SELECT_SITE_URL } from "@/lib/notify-messages";
import { buildTempLocalAnalysisSite } from "@/lib/temp-local-analysis-site";
import type { WordPressSite } from "@/components/integrations/types";
import { getPublicSiteUrl } from "@/lib/wordpress-site-public-url";
import {
  analyzeBacklinkTiles,
  sortBacklinkTilesByPriority,
  type BacklinkTile,
} from "@/lib/backlink-research/openrouter-backlink-tiles";
import {
  initialBacklinkTileRows,
  type BacklinkTileRow,
} from "@/lib/backlink-research/backlink-tile-enriched";
import { runBacklinkEnrichmentPipeline } from "@/lib/backlink-research/run-backlink-enrichment";
import {
  copyTextToClipboard,
  csvRowFromEnrichment,
  downloadBacklinkBulkCsv,
  buildSingleEnrichedRowCsv,
} from "@/lib/backlink-research/backlink-bulk-csv-export";
import {
  buildSerpDigestText,
  fetchWriteForUsSerpOrganic,
  mergeSerpTitlesIntoBacklinkTiles,
} from "@/lib/backlink-research/serp-write-for-us";
import { extractIndustryKeywordsFromGmbOpenRouter } from "@/lib/backlink-research/gbp-industry-keyword-openrouter";
import { fetchLocalStrategyGmbDfsRaw } from "@/lib/local-strategy-research/local-strategy-gmb-fetch";
import { dataForSeoSerpLocationFromGbp, parseGmbDfsBusinessInfo } from "@/lib/gmb-dfs-parse";
import { getPrimaryCityStateLabel } from "@/lib/primary-location-from-site";
import { fetchLocationDiscovery } from "@/lib/fetch-location-discovery";
import { cn } from "@/lib/utils";
import { BacklinkBlogPitchSheet } from "@/components/research/backlinking/BacklinkBlogPitchSheet";
import { useManagerSeedWorkspace } from "@/contexts/manager-seed-workspace-context";
import { BacklinkFormSubmissionCard } from "@/components/research/backlinking/BacklinkFormSubmissionCard";
import { BacklinkSubmissionHowToCard } from "@/components/research/backlinking/BacklinkSubmissionHowToCard";
const DFS_ABORT_MS = 120_000;
const SERP_DEPTH = 15;

function businessLabelForGmb(site: WordPressSite): string {
  const n = site.napInfo?.name?.trim() || site.name?.trim();
  if (n) return n;
  try {
    const web = getPublicSiteUrl(site);
    const u = new URL(web.includes("://") ? web : `https://${web}`);
    return u.hostname.replace(/^www\./i, "") || "business";
  } catch {
    return "business";
  }
}

export function BacklinkingResearchTab() {
  const {
    mode: workspaceMode,
    tempSeedUrl,
    connectedSite: site,
  } = useManagerSeedWorkspace();
  const effectiveSite = useMemo((): WordPressSite => {
    if (workspaceMode === "temp") {
      return buildTempLocalAnalysisSite(tempSeedUrl);
    }
    return site ?? buildTempLocalAnalysisSite("");
  }, [workspaceMode, tempSeedUrl, site]);

  const publicWebUrl = useMemo(() => getPublicSiteUrl(effectiveSite), [effectiveSite]);

  /** Display name for the user's site (guest-post subject "Company" slot). */
  const connectedSiteNameForPitch = useMemo(() => {
    const rawName = effectiveSite.name?.trim();
    if (rawName && rawName !== "Temp seed") return rawName;
    const u = publicWebUrl?.trim();
    if (u) {
      try {
        const url = new URL(u.includes("://") ? u : `https://${u}`);
        const h = url.hostname.replace(/^www\./i, "");
        if (h) return h;
      } catch {
        /* ignore */
      }
    }
    return "your site";
  }, [effectiveSite.name, publicWebUrl]);

  const [industry, setIndustry] = useState("");
  const [locationName, setLocationName] = useState("");
  /** When true, SERP location is not overwritten by GBP-derived location. */
  const serpLocationTouchedByUserRef = useRef(false);
  /** After "From GBP", AI suggests these; user picks one to run SERP. */
  const [gmbIndustryChoices, setGmbIndustryChoices] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingHint, setLoadingHint] = useState<string | null>(null);
  const [tileRows, setTileRows] = useState<BacklinkTileRow[] | null>(null);
  const [digestPreview, setDigestPreview] = useState<string | null>(null);
  const [lastKeyword, setLastKeyword] = useState<string | null>(null);
  const [enrichBatchRunning, setEnrichBatchRunning] = useState(false);
  const tileRowsRef = useRef<BacklinkTileRow[] | null>(null);

  useEffect(() => {
    tileRowsRef.current = tileRows;
  }, [tileRows]);

  useEffect(() => {
    setTileRows(null);
    setDigestPreview(null);
    setLastKeyword(null);
    setGmbIndustryChoices(null);
    setLocationName("");
    serpLocationTouchedByUserRef.current = false;
  }, [workspaceMode, tempSeedUrl, site?.id]);

  const industryForEnrich = useMemo(() => {
    const fromField = industry.trim();
    if (fromField) return fromField;
    if (lastKeyword) {
      return lastKeyword.replace(/\s+write for us$/i, "").trim();
    }
    return "";
  }, [industry, lastKeyword]);

  const runSerpAndTiles = useCallback(
    async (industryKeyword: string, signal: AbortSignal) => {
      const apiKey = loadApiKey()?.trim();
      if (!apiKey) {
        throw new Error(NOTIFY_OPENROUTER_KEY);
      }

      const { keyword, rows } = await fetchWriteForUsSerpOrganic({
        industry: industryKeyword,
        location_name: locationName.trim(),
        depth: SERP_DEPTH,
        signal,
      });
      setLastKeyword(keyword);

      const digest = buildSerpDigestText({ keyword, rows });
      setDigestPreview(digest);

      if (!rows.length) {
        notify.error(NOTIFY_NO_ORGANIC_RESULTS_FOR_THIS_SEARCH_TRY_A);
        setTileRows(null);
        return;
      }

      const model = getResearchModel(site?.id);
      const out = await analyzeBacklinkTiles({
        apiKey,
        model,
        serpDigest: digest,
        industry: industryKeyword,
        siteUrl: publicWebUrl.trim(),
        siteName: site?.name?.trim(),
        signal,
      });

      const baseTilesRaw: BacklinkTile[] = out.length
        ? out
        : rows.map((r) => ({
            url: r.url,
            summary: r.description || r.title || "No snippet.",
            serpTitle: r.title?.trim() || undefined,
          }));
      const baseTiles = sortBacklinkTilesByPriority(
        mergeSerpTitlesIntoBacklinkTiles(rows, baseTilesRaw),
      );
      setTileRows(initialBacklinkTileRows(baseTiles));
    },
    [publicWebUrl, locationName, site?.id, site?.name],
  );

  const enrichOne = useCallback(
    async (index: number) => {
      const apiKey = loadApiKey()?.trim();
      if (!apiKey) {
        notify.error(NOTIFY_OPENROUTER_KEY);
        return;
      }
      const ind = industryForEnrich.trim();
      if (!ind) {
        notify.error(NOTIFY_ENTER_AN_INDUSTRY_OR_RUN_A_SEARCH_FIRST_);
        return;
      }
      const row = tileRowsRef.current?.[index];
      if (!row || row.enrichStatus === "fetching") return;
      if (row.enrichStatus === "done") return;

      setTileRows((prev) => {
        if (!prev?.[index]) return prev;
        const next = [...prev];
        next[index] = { ...next[index], enrichStatus: "fetching", enrichError: undefined };
        return next;
      });

      const signal = AbortSignal.timeout(DFS_ABORT_MS);
      const model = getResearchModel(site?.id);

      try {
        const result = await runBacklinkEnrichmentPipeline({
          url: row.url,
          industry: ind,
          serpSummary: row.summary,
          apiKey,
          model,
          siteName: connectedSiteNameForPitch,
          signal,
        });

        if (!result.ok) {
          setTileRows((prev) => {
            if (!prev?.[index]) return prev;
            const next = [...prev];
            next[index] = {
              ...next[index],
              enrichStatus: "error",
              enrichError: result.error,
            };
            return next;
          });
          return;
        }

        setTileRows((prev) => {
          if (!prev?.[index]) return prev;
          const next = [...prev];
          next[index] = {
            ...next[index],
            enrichStatus: "done",
            enrichment: result.enrichment,
            enrichError: undefined,
          };
          return next;
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setTileRows((prev) => {
          if (!prev?.[index]) return prev;
          const next = [...prev];
          next[index] = {
            ...next[index],
            enrichStatus: "error",
            enrichError: msg.slice(0, 200),
          };
          return next;
        });
      }
    },
    [connectedSiteNameForPitch, industryForEnrich, site?.id],
  );

  const runEnrichAll = useCallback(async () => {
    if (!tileRowsRef.current?.length) return;
    const apiKey = loadApiKey()?.trim();
    if (!apiKey) {
      notify.error(NOTIFY_OPENROUTER_KEY);
      return;
    }
    if (!industryForEnrich.trim()) {
      notify.error(NOTIFY_ENTER_AN_INDUSTRY_OR_RUN_A_SEARCH_FIRST_);
      return;
    }
    setEnrichBatchRunning(true);
    try {
      const n = tileRowsRef.current?.length ?? 0;
      for (let i = 0; i < n; i++) {
        if (tileRowsRef.current?.[i]?.enrichStatus === "done") continue;
        await enrichOne(i);
      }
    } finally {
      setEnrichBatchRunning(false);
    }
  }, [enrichOne, industryForEnrich]);

  const run = useCallback(async () => {
    if (!effectiveSite.siteUrl.trim()) {
      notify.error(workspaceMode === "temp" ? NOTIFY_SEED_SITE_URL_EXAMPLE : NOTIFY_SELECT_SITE_URL);
      return;
    }
    if (!industry.trim()) {
      notify.error(NOTIFY_ENTER_AN_INDUSTRY_OR_NICHE_KEYWORD);
      return;
    }
    const apiKey = loadApiKey()?.trim();
    if (!apiKey) {
      notify.error(NOTIFY_OPENROUTER_KEY);
      return;
    }

    setLoading(true);
    setLoadingHint(null);
    setTileRows(null);
    setDigestPreview(null);
    setLastKeyword(null);
    setGmbIndustryChoices(null);
    const signal = AbortSignal.timeout(DFS_ABORT_MS);

    try {
      await runSerpAndTiles(industry.trim(), signal);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      notify.error(msg);
      setTileRows(null);
    } finally {
      setLoading(false);
      setLoadingHint(null);
    }
  }, [effectiveSite.siteUrl, industry, runSerpAndTiles, workspaceMode]);

  const runSerpWithGbpKeyword = useCallback(
    async (picked: string) => {
      const kw = picked.trim();
      if (!kw) return;
      if (!effectiveSite.siteUrl.trim()) {
        notify.error(workspaceMode === "temp" ? NOTIFY_SEED_SITE_URL_EXAMPLE : NOTIFY_SELECT_SITE_URL);
        return;
      }
      const apiKey = loadApiKey()?.trim();
      if (!apiKey) {
        notify.error(NOTIFY_OPENROUTER_KEY);
        return;
      }

      setGmbIndustryChoices(null);
      setLoading(true);
      setLoadingHint("SERP and tiles…");
      setTileRows(null);
      setDigestPreview(null);
      setLastKeyword(null);
      setIndustry(kw);
      const signal = AbortSignal.timeout(DFS_ABORT_MS);

      try {
        await runSerpAndTiles(kw, signal);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        notify.error(msg);
        setTileRows(null);
      } finally {
        setLoading(false);
        setLoadingHint(null);
      }
    },
    [effectiveSite.siteUrl, runSerpAndTiles, workspaceMode],
  );

  const runFromGbp = useCallback(async () => {
    if (!effectiveSite.siteUrl.trim()) {
      notify.error(workspaceMode === "temp" ? NOTIFY_SEED_SITE_URL_EXAMPLE : NOTIFY_SELECT_SITE_URL);
      return;
    }
    const apiKey = loadApiKey()?.trim();
    if (!apiKey) {
      notify.error(NOTIFY_OPENROUTER_KEY);
      return;
    }

    setGmbIndustryChoices(null);
    setLoading(true);
    setLoadingHint("Fetching GBP…");
    setTileRows(null);
    setDigestPreview(null);
    setLastKeyword(null);
    const signal = AbortSignal.timeout(DFS_ABORT_MS);

    try {
      let cityRegion = getPrimaryCityStateLabel(effectiveSite) ?? "";
      if (!cityRegion.trim() && publicWebUrl.trim()) {
        try {
          const disc = await fetchLocationDiscovery(publicWebUrl.trim());
          cityRegion =
            disc.primarySuggestion?.trim() ||
            disc.primaryAreaLabel?.trim() ||
            (Array.isArray(disc.areaLabels) && disc.areaLabels[0]
              ? String(disc.areaLabels[0]).trim()
              : "") ||
            "";
        } catch {
          /* ignore */
        }
      }

      const biz = businessLabelForGmb(effectiveSite);
      const gmbKw = cityRegion.trim() ? `${biz} ${cityRegion.trim()}` : biz;

      setLoadingHint("GBP live request…");
      const gmbJson = await fetchLocalStrategyGmbDfsRaw({
        keyword: gmbKw,
        locationName: cityRegion.trim() || undefined,
        websiteUrl: publicWebUrl.trim() || undefined,
        signal,
      });

      if (gmbJson == null) {
        notify.error(NOTIFY_GOOGLE_BUSINESS_PROFILE_REQUEST_RETURNED);
        setTileRows(null);
        return;
      }

      const gbp = parseGmbDfsBusinessInfo(gmbJson);
      if (!serpLocationTouchedByUserRef.current && gbp) {
        const serpLoc = dataForSeoSerpLocationFromGbp(gbp, publicWebUrl.trim());
        if (serpLoc) {
          setLocationName(serpLoc);
        }
      }

      setLoadingHint("AI suggests niche keywords…");
      const model = getResearchModel(site?.id);
      const choices = await extractIndustryKeywordsFromGmbOpenRouter({
        apiKey,
        model,
        gmbJson,
        siteUrl: publicWebUrl.trim(),
        signal,
      });

      if (!choices.length) {
        notify.error(NOTIFY_AI_COULD_NOT_SUGGEST_INDUSTRY_KEYWORDS_F);
        setTileRows(null);
        return;
      }

      setGmbIndustryChoices(choices);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      notify.error(msg.length > 160 ? "GBP or AI step failed." : msg);
      setTileRows(null);
    } finally {
      setLoading(false);
      setLoadingHint(null);
    }
  }, [effectiveSite, publicWebUrl, site?.id, workspaceMode]);

  const busy = loading;

  const canOpenDetails = useMemo(
    () =>
      busy ||
      Boolean(lastKeyword) ||
      Boolean(industry.trim()) ||
      Boolean(tileRows?.length) ||
      Boolean(gmbIndustryChoices?.length) ||
      Boolean(digestPreview),
    [busy, lastKeyword, industry, tileRows, gmbIndustryChoices, digestPreview],
  );

  const siteReady = Boolean(effectiveSite.siteUrl?.trim());

  return (
    <div className={SEO_WORKSPACE_SHELL_CLASS}>
      {workspaceMode === "connected" && (!site || !site.siteUrl?.trim()) ? (
        <div className="flowbie-zone-tile--data px-2 py-3 text-base leading-normal text-muted-foreground">
          {!site
            ? "Connect a WordPress site and select it in the header, or switch to Temp seed."
            : "This site has no URL saved."}
        </div>
      ) : (
        <>
          <div className={SEO_WORKSPACE_HEADER_CLASS}>
            <BacklinkingWorkspaceHeader
              busy={busy}
              loadingHint={loadingHint}
              canOpenDetails={canOpenDetails}
              toolbarProps={{
                busy,
                canRun: siteReady,
                onFromGbp: () => void runFromGbp(),
                onRun: () => void run(),
              }}
              detailsProps={{
                loadingHint,
                lastKeyword,
                industry,
                locationName,
                gmbChoiceCount: gmbIndustryChoices?.length ?? 0,
                tileCount: tileRows?.length ?? 0,
              }}
            />
          </div>

          <div className={cn(SEO_WORKSPACE_BODY_SCROLL_CLASS, "space-y-2")}>
            <div className="rounded-lg border border-border/50 bg-black/25 px-2.5 py-2 sm:px-3 sm:py-2.5">
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                <WorkspaceNestedInput
                  id="backlink-industry"
                  layout="inline"
                  label="Industry / niche"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  disabled={busy}
                />
                <WorkspaceNestedInput
                  id="backlink-serp-location"
                  layout="inline"
                  label="SERP location"
                  value={locationName}
                  onChange={(e) => {
                    serpLocationTouchedByUserRef.current = true;
                    setLocationName(e.target.value);
                  }}
                  disabled={busy}
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 text-base">            {busy ? (
              <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-black/15 px-3 py-4 text-base text-white">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-white" />
                {loadingHint ?? "DataForSEO SERP, then OpenRouter…"}
              </div>
            ) : null}

            {!busy && gmbIndustryChoices && gmbIndustryChoices.length > 0 ? (
              <div
                className="rounded-lg border border-[hsl(var(--semantic-data)/0.4)] bg-black/25 px-3 py-3 sm:px-4"
                role="region"
                aria-label="Choose niche keyword from GBP"
              >
                <div className="flex flex-wrap gap-2">
                  {gmbIndustryChoices.map((k) => (
                    <Button
                      key={k}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-auto min-h-9 max-w-full whitespace-normal border border-[hsl(var(--semantic-data)/0.5)] bg-black/35 px-3 py-1.5 text-left text-base font-semibold leading-snug text-white hover:border-[hsl(var(--semantic-data)/0.75)] hover:bg-[hsl(var(--semantic-data)/0.12)] hover:text-white"
                      onClick={() => void runSerpWithGbpKeyword(k)}
                    >
                      {k}
                    </Button>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-9 min-h-9 text-base text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={() => setGmbIndustryChoices(null)}
                >
                  Dismiss
                </Button>
              </div>
            ) : null}

            {!busy && lastKeyword ? (
              <p className="text-base text-white/95">
                Keyword: <span className="font-mono text-white">{lastKeyword}</span>
              </p>
            ) : null}

            {!busy && tileRows && tileRows.length > 0 ? (
              <div className="flowbie-zone-tile--analysis mt-2 space-y-3 px-2 py-2 sm:px-3">
                <div className="mb-1 flex flex-wrap items-center gap-2 py-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 border-0 text-[hsl(var(--semantic-analysis-foreground))] shadow-none hover:bg-[hsl(var(--semantic-analysis)/0.12)] hover:text-white"
                        disabled={busy || enrichBatchRunning || !industryForEnrich.trim()}
                        onClick={() => void runEnrichAll()}
                        aria-label="Pull submission guidelines for every URL"
                      >
                        {enrichBatchRunning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wand2 className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[16rem] text-base">
                      Pull submission guidelines for every URL (DataForSEO page parse + AI)
                    </TooltipContent>
                  </Tooltip>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 min-h-9 border border-[hsl(var(--semantic-analysis)/0.4)] bg-black/25 text-base font-semibold text-white shadow-none hover:border-[hsl(var(--semantic-analysis)/0.55)] hover:bg-[hsl(var(--semantic-analysis)/0.1)] hover:text-white"
                    disabled={
                      busy ||
                      !tileRows.some((r) => r.enrichment) ||
                      enrichBatchRunning
                    }
                    onClick={() => {
                      const rows = tileRows
                        .filter((r) => r.enrichment)
                        .map((r) => csvRowFromEnrichment(r.enrichment!));
                      downloadBacklinkBulkCsv(rows, "backlink-bulk-prompt");
                    }}
                  >
                    <FileDown className="mr-2 h-3.5 w-3.5" />
                    Download bulk CSV
                  </Button>
                </div>

                {tileRows.map((t, i) => (
                  <div
                    key={`${t.url}-${i}`}
                    className={cn(
                      "flowbie-zone-row flowbie-zone-row--analysis flex w-full min-w-0 max-w-full flex-col gap-2 pt-2 pb-2 text-base text-white",
                    )}
                  >
                    <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="space-y-2">
                          {t.enrichment ? (
                            <>
                              <h3 className="min-w-0 text-base font-semibold leading-snug tracking-tight text-white">
                                {t.enrichment.pageTitle}
                              </h3>
                              {t.enrichment.displayTitle.trim() &&
                              t.enrichment.displayTitle.trim().toLowerCase() !==
                                t.enrichment.pageTitle.trim().toLowerCase() ? (
                                <p className="text-base leading-snug text-white/85">{t.enrichment.displayTitle}</p>
                              ) : null}
                            </>
                          ) : (
                            <>
                              <h3 className="min-w-0 text-base font-semibold leading-snug text-white">
                                {t.serpTitle?.trim() ||
                                  (() => {
                                    try {
                                      const h = new URL(t.url).hostname.replace(/^www\./i, "");
                                      return h || "Placement URL";
                                    } catch {
                                      return "Placement URL";
                                    }
                                  })()}
                              </h3>
                              <p className="line-clamp-2 text-base leading-relaxed text-white/90">
                                {t.summary}
                              </p>
                            </>
                          )}
                        </div>

                        {t.enrichment ? (
                          <div className="rounded-md border border-[hsl(var(--semantic-analysis)/0.22)] bg-[hsl(var(--semantic-analysis)/0.06)] px-3 py-2.5">
                            <p className="text-base font-semibold uppercase tracking-wide text-[hsl(var(--semantic-analysis-foreground)/0.95)]">
                              Playbook
                            </p>
                            <p className="mt-1.5 text-base leading-relaxed text-white/95">{t.enrichment.actionSummary}</p>
                          </div>
                        ) : null}

                        <div className="rounded-md border border-border/35 bg-black/20 px-3 py-2">
                          <a
                            href={t.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center gap-1.5 text-base font-medium text-[hsl(var(--semantic-data-foreground))] underline decoration-[hsl(var(--semantic-data)/0.45)] underline-offset-2 hover:decoration-[hsl(var(--semantic-data)/0.75)]"
                          >
                            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
                            <span className="break-all">{t.url}</span>
                          </a>
                          {t.pursue ? (
                            <p className="mt-2 text-base text-white/95">
                              <span className="font-semibold text-white">Fit:</span> {t.pursue}
                            </p>
                          ) : null}
                        </div>

                        {t.enrichStatus === "error" && t.enrichError ? (
                          <p className="text-base text-red-400">{t.enrichError}</p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 items-start gap-1 sm:flex-col sm:items-end">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 border-0 text-[hsl(var(--semantic-analysis-foreground))] shadow-none hover:bg-[hsl(var(--semantic-analysis)/0.12)] hover:text-white"
                              disabled={
                                busy ||
                                enrichBatchRunning ||
                                t.enrichStatus === "fetching" ||
                                !industryForEnrich.trim()
                              }
                              onClick={() => void enrichOne(i)}
                              aria-label="Pull submission guidelines for this URL"
                            >
                              {t.enrichStatus === "fetching" ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Wand2 className="h-4 w-4" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-[14rem] text-base">
                            Parse this page and fill playbook + CSV fields
                          </TooltipContent>
                        </Tooltip>
                        {t.enrichment ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 min-h-9 border border-[hsl(var(--semantic-data)/0.45)] bg-black/20 text-base font-semibold text-white shadow-none hover:border-[hsl(var(--semantic-data)/0.65)] hover:bg-[hsl(var(--semantic-data)/0.08)] hover:text-white"
                            onClick={async () => {
                              const txt = buildSingleEnrichedRowCsv(t.enrichment!);
                              const ok = await copyTextToClipboard(txt);
                              notify[ok ? "success" : "error"](
                                ok ? "Copied CSV row" : "Could not copy",
                              );
                            }}
                          >
                            <Copy className="mr-1.5 h-3.5 w-3.5" />
                            Copy CSV row
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {t.enrichment ? (
                      <div className="w-full min-w-0 space-y-3">
                        <BacklinkSubmissionHowToCard enrichment={t.enrichment} />
                        <BacklinkBlogPitchSheet enrichment={t.enrichment} pageUrl={t.url} />
                        <BacklinkFormSubmissionCard
                          enrichment={t.enrichment}
                          connectedSiteName={connectedSiteNameForPitch}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}

            {!busy && tileRows && tileRows.length === 0 ? (
              <p className="text-base text-white/95">No tiles returned.</p>
            ) : null}

            {!busy && digestPreview && !tileRows?.length ? (
              <pre className="max-h-48 overflow-auto rounded-lg border border-border/40 bg-black/15 p-2 text-base leading-normal text-white/95">
                {digestPreview}
              </pre>
            ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}