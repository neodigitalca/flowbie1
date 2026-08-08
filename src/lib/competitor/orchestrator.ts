import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import {
  applyCompetitorHarnessStep,
  buildCompetitorHarnessGroups,
  setCompetitorHarnessTitle,
} from "@/lib/competitor-analysis/competitor-comparison-harness-state";
import { runCompareCompetitorAgent } from "@/lib/competitor/compare-competitor-agent";
import { runCompetitorTitleRowAgent, suggestCompetitorTitleFormat } from "@/lib/competitor/competitor-title-row-agent";
import { fetchCompetitorDfsIntel } from "@/lib/competitor/fetch-competitor-dfs-intel";
import {
  filterPlacesExcludingConnectedSite,
  GRID_ONLY_CONNECTED_SITE_MESSAGE,
  isConnectedSitePlace,
} from "@/lib/competitor/filter-connected-site-competitors";
import { runExtractCompetitorProfileAgent } from "@/lib/competitor/extract-competitor-profile-agent";
import { readConnectedSiteProfile } from "@/lib/competitor/read-connected-site";
import type {
  CompetitorGenerationOptions,
  CompetitorOrchestratorResult,
  CompetitorProgressCallback,
  CompetitorSiteProfile,
  CompetitorWithRow,
} from "@/lib/competitor/types";

function logStep(onProgress: CompetitorProgressCallback | undefined, message: string, harnessGroups?: ReturnType<typeof buildCompetitorHarnessGroups>): void {
  onProgress?.(message, harnessGroups);
}

function skipCompetitorHarnessSteps(
  harnessGroups: ReturnType<typeof buildCompetitorHarnessGroups>,
  competitorKey: string,
  fromStep: "ScanSitemap",
  detail: string,
): ReturnType<typeof buildCompetitorHarnessGroups> {
  let groups = harnessGroups;
  groups = applyCompetitorHarnessStep(groups, competitorKey, fromStep, {
    status: "skipped",
    detail,
  });
  for (const stepId of ["ExtractMeta", "BuildComparison", "WriteCsvRow"] as const) {
    groups = applyCompetitorHarnessStep(groups, competitorKey, stepId, { status: "skipped" });
  }
  return groups;
}

export async function runCompetitorOrchestrator(
  options: CompetitorGenerationOptions,
  onProgress?: CompetitorProgressCallback,
): Promise<CompetitorOrchestratorResult> {
  const { site, places, keyword, promptModifier, apiKey, model } = options;
  if (places.length === 0) {
    throw new Error("No competitors to generate.");
  }
  if (!keyword.trim()) {
    throw new Error("Keyword is required.");
  }
  const trimmedKeyword = keyword.trim();

  const filteredPlaces = filterPlacesExcludingConnectedSite(places, site);
  if (filteredPlaces.length === 0) {
    throw new Error(GRID_ONLY_CONNECTED_SITE_MESSAGE);
  }

  let harnessGroups = buildCompetitorHarnessGroups(filteredPlaces.map((p) => p.businessName));

  logStep(onProgress, "Reading connected site profile…", harnessGroups);

  const connectedProfile = await readConnectedSiteProfile(site, (msg) =>
    logStep(onProgress, msg, harnessGroups),
  );

  const suggestedTitleFormat = suggestCompetitorTitleFormat(trimmedKeyword);
  const competitors: CompetitorWithRow[] = [];

  for (let i = 0; i < filteredPlaces.length; i++) {
    const place = filteredPlaces[i]!;
    const group = harnessGroups[i]!;
    const competitorKey = group.competitorKey;

    if (isConnectedSitePlace(place, site)) {
      harnessGroups = skipCompetitorHarnessSteps(
        harnessGroups,
        competitorKey,
        "ScanSitemap",
        "Connected site excluded",
      );
      logStep(onProgress, `Skipped ${place.businessName} (connected site excluded)`, harnessGroups);
      continue;
    }

    harnessGroups = applyCompetitorHarnessStep(harnessGroups, competitorKey, "ScanSitemap", {
      status: "generating",
    });
    logStep(onProgress, `Google SERP query for ${place.businessName}…`, harnessGroups);

    const intel = await fetchCompetitorDfsIntel({
      place,
      focusKeyword: trimmedKeyword,
      site,
    });

    if (intel.serpHitCount === 0) {
      harnessGroups = skipCompetitorHarnessSteps(harnessGroups, competitorKey, "ScanSitemap", "0 SERP hits");
      logStep(onProgress, `Skipped ${place.businessName} (0 SERP hits)`, harnessGroups);
      continue;
    }

    harnessGroups = applyCompetitorHarnessStep(harnessGroups, competitorKey, "ScanSitemap", {
      status: "done",
      detail: `"${intel.serpKeyword}" · ${intel.serpHitCount} hit(s)`,
    });

    harnessGroups = applyCompetitorHarnessStep(harnessGroups, competitorKey, "ExtractMeta", {
      status: "generating",
    });
    logStep(onProgress, `Extracting SERP snippets for ${place.businessName}…`, harnessGroups);

    const topPages = intel.topPages;
    const profileExtras = await runExtractCompetitorProfileAgent({
      apiKey,
      model,
      businessName: place.businessName,
      domain: null,
      pages: topPages,
    });

    const profile: CompetitorSiteProfile = {
      businessName: place.businessName,
      domain: null,
      homepageUrl: topPages[0]?.url ?? null,
      sitemapUrl: null,
      topPages,
      ...profileExtras,
    };

    harnessGroups = applyCompetitorHarnessStep(harnessGroups, competitorKey, "ExtractMeta", {
      status: topPages.length > 0 ? "done" : "skipped",
      detail: `${topPages.length} snippet(s)`,
    });

    harnessGroups = applyCompetitorHarnessStep(harnessGroups, competitorKey, "BuildComparison", {
      status: "generating",
    });
    logStep(onProgress, `Building comparison for ${place.businessName}…`, harnessGroups);

    const comparison = await runCompareCompetitorAgent({
      apiKey,
      model,
      keyword: trimmedKeyword,
      promptModifier,
      connected: connectedProfile,
      competitor: profile,
    });

    harnessGroups = applyCompetitorHarnessStep(harnessGroups, competitorKey, "BuildComparison", {
      status: "done",
    });

    harnessGroups = applyCompetitorHarnessStep(harnessGroups, competitorKey, "WriteCsvRow", {
      status: "generating",
    });

    const { title, modifier } = await runCompetitorTitleRowAgent({
      apiKey,
      model,
      keyword: trimmedKeyword,
      entity: place.businessName,
      connected: connectedProfile,
      comparison,
      suggestedTitleFormat,
    });

    harnessGroups = applyCompetitorHarnessStep(harnessGroups, competitorKey, "WriteCsvRow", {
      status: "done",
      detail: title,
    });
    harnessGroups = setCompetitorHarnessTitle(harnessGroups, competitorKey, title);

    const row: CSVRow = {
      keyword: trimmedKeyword,
      entity: place.businessName,
      title,
      modifier,
      featuredImage: "n",
    };

    competitors.push({ place, domain: null, profile, comparison, row });
    options.onRowsUpdate?.(competitors);
    logStep(onProgress, `Completed ${place.businessName}`, harnessGroups);
  }

  if (competitors.length === 0) {
    throw new Error("No competitors returned SERP results. Check your grid CSV or try a different keyword.");
  }

  logStep(onProgress, `Generated ${competitors.length} competitor row(s)`, harnessGroups);

  return {
    competitors,
    suggestedTitleFormat,
    connectedProfile,
  };
}
