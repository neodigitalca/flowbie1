import pLimit from "p-limit";
import { notify } from "@/lib/app-notifications";
import { NOTIFY_COULD_NOT_DERIVE_A_FOCUS_KEYWORD_FOR_THI, NOTIFY_COULD_NOT_SAVE_SEO_BRIEF_FILE_ON_SERVER_, NOTIFY_DATAFORSEO_SERP_STORED_AND_JSON_CONTENT_, NOTIFY_GSC_KEYWORDS_FOR_THIS_PAGE_URL_FAILED_SE, NOTIFY_SEO_JSON_BRIEF_MERGE_FAILED_RESEARCH_FIL, NOTIFY_SERP_CALL_COMPLETED_BUT_NO_BRIEF_WAS_SAV, NOTIFY_SERP_RESPONSE_WAS_NOT_VALID_JSON_JSON_BR, NOTIFY_SERP_SAVED, notifyCouldNotLoadSerpFileForTheJsonBr, notifyErrorMessage } from "@/lib/notify-messages";
import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";
import {
  buildMergedSeoContentBrief,
  parseGscBriefFromContext,
} from "@/lib/overview-seo-content-brief";
import {
  RESEARCH_HARNESS_SECTION_TITLES,
  RESEARCH_HARNESS_TOTAL_SECTIONS,
  type ResearchHarnessDoneSummary,
} from "@/lib/overview/overview-research-harness-sections";
import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";
import { fetchSemrushBulkEnrichment } from "@/lib/wordpress-api/semrush";
import { mcp_DataForSEO_serp_organic_live_advanced } from "@/lib/mcp-tools";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { WordPressSite } from "@/components/integrations/types";

const SEO_BRIEF_SAVE_CONCURRENCY = 20;
const seoBriefSaveLimit = pLimit(SEO_BRIEF_SAVE_CONCURRENCY);

export type OverviewResearchRowInput = {
  row: OverviewRow;
  rowIndex?: number;
  site: WordPressSite | undefined;
  /** Site-wide GSC CSV filename (if already loaded). */
  gscQuickWinsFile: string | null;
  /** Pre-resolved batch GSC CSV (site-wide file). */
  gscCsvForBatch?: string | null;
  /** Await shared batch GSC export (non-blocking at batch level). */
  resolveGscCsv?: () => Promise<string | null>;
  /** Research All batch: skip per-row GSC export fallback. */
  batchResearchMode?: boolean;
  serpDumpUrl: (filename: string) => string;
  portfolioBlockedHostsForSemrush: string[];
  skipGsc?: boolean;
  silent?: boolean;
  onHarnessSection?: (payload: BulkHarnessSectionPayload) => void;
};

function emitHarnessSection(
  input: OverviewResearchRowInput,
  sectionIndex: number,
  phase: BulkHarnessSectionPayload["phase"],
  markdownSlice?: string,
): void {
  const rowIndex = input.rowIndex ?? 0;
  input.onHarnessSection?.({
    rowIndex,
    sectionIndex,
    totalSections: RESEARCH_HARNESS_TOTAL_SECTIONS,
    title: RESEARCH_HARNESS_SECTION_TITLES[sectionIndex] ?? `Section ${sectionIndex + 1}`,
    phase,
    markdownSlice,
  });
}

export async function exportOverviewGscForPageUrls(
  siteUrl: string,
  pageUrls: string[],
): Promise<string | null> {
  if (!BACKEND_API_BASE || !siteUrl.trim() || pageUrls.length === 0) return null;
  const unique = [...new Set(pageUrls.map((u) => u.trim()).filter(Boolean))];
  if (!unique.length) return null;
  try {
    const exportRes = await fetch(`${BACKEND_API_BASE}/api/gsc/export-overview-quick-wins`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteUrl: siteUrl.trim(),
        pageUrls: unique,
      }),
    });
    const exportJson = await exportRes.json().catch(() => null);
    if (exportRes.ok && exportJson?.storedFile) {
      return String(exportJson.storedFile);
    }
  } catch {
    /* optional */
  }
  return null;
}

function emitGscSectionDone(
  input: OverviewResearchRowInput,
  filename: string | null,
  harnessSummaries: ResearchHarnessDoneSummary,
): string | null {
  if (input.skipGsc === true) {
    const preset = input.row.gscQuickWinsCsvFilename ?? input.gscQuickWinsFile ?? null;
    harnessSummaries["GSC CSV"] = preset ? `GSC CSV: ${preset}` : "GSC skipped";
    emitHarnessSection(input, 1, "done", harnessSummaries["GSC CSV"]);
    return preset;
  }
  harnessSummaries["GSC CSV"] = filename ? `GSC CSV: ${filename}` : "GSC CSV unavailable";
  emitHarnessSection(input, 1, "done", harnessSummaries["GSC CSV"]);
  return filename;
}

async function resolveGscFilenameForRow(
  input: OverviewResearchRowInput,
  harnessSummaries: ResearchHarnessDoneSummary,
): Promise<string | null> {
  const { row, site, gscQuickWinsFile, gscCsvForBatch, resolveGscCsv } = input;
  const silent = input.silent === true;
  const batchResearchMode = input.batchResearchMode === true;

  if (input.skipGsc === true) {
    return emitGscSectionDone(input, null, harnessSummaries);
  }

  const preset = gscCsvForBatch ?? row.gscQuickWinsCsvFilename ?? gscQuickWinsFile ?? null;
  if (preset) {
    return emitGscSectionDone(input, preset, harnessSummaries);
  }

  if (batchResearchMode) {
    return emitGscSectionDone(input, null, harnessSummaries);
  }

  emitHarnessSection(input, 1, "start");

  if (resolveGscCsv) {
    const batchFile = await resolveGscCsv();
    if (batchFile) {
      return emitGscSectionDone(input, batchFile, harnessSummaries);
    }
  }

  if (site?.siteUrl && BACKEND_API_BASE && row.url?.trim()) {
    const single = await exportOverviewGscForPageUrls(site.siteUrl, [row.url.trim()]);
    if (single) {
      return emitGscSectionDone(input, single, harnessSummaries);
    }
    if (!silent) {
      notify.warning(NOTIFY_GSC_KEYWORDS_FOR_THIS_PAGE_URL_FAILED_SE);
    }
  }

  return emitGscSectionDone(input, null, harnessSummaries);
}

async function runSemrushEnrichment(
  input: OverviewResearchRowInput,
  keyword: string,
  harnessSummaries: ResearchHarnessDoneSummary,
): Promise<{ storedFile: string | null; errors?: { message?: string }[] } | null> {
  const { row, portfolioBlockedHostsForSemrush, silent } = input;
  emitHarnessSection(input, 2, "start");
  if (!BACKEND_API_BASE) {
    harnessSummaries["Semrush enrichment"] = "Semrush API unavailable";
    emitHarnessSection(input, 2, "done", harnessSummaries["Semrush enrichment"]);
    return null;
  }
  const result = await fetchSemrushBulkEnrichment({
    pageUrl: row.url?.trim() ?? "",
    seedKeyword: keyword,
    portfolioBlockedHosts:
      portfolioBlockedHostsForSemrush.length > 0 ? portfolioBlockedHostsForSemrush : undefined,
  }).catch(() => null);
  if (result?.storedFile) {
    harnessSummaries["Semrush enrichment"] = `Semrush: ${result.storedFile}`;
  } else if (result && !silent) {
    notify.warning("Semrush skipped");
    harnessSummaries["Semrush enrichment"] = "Semrush enrichment skipped or failed";
  } else {
    harnessSummaries["Semrush enrichment"] = "Semrush enrichment skipped or failed";
  }
  emitHarnessSection(input, 2, "done", harnessSummaries["Semrush enrichment"]);
  return result;
}

async function loadGscBriefContext(
  filename: string,
  pageUrl: string,
): Promise<{ queries: string[]; pageUrl: string }> {
  const fallback = { queries: [] as string[], pageUrl };
  if (!BACKEND_API_BASE || !filename.trim() || !pageUrl.trim()) return fallback;
  try {
    const ctxRes = await fetch(`${BACKEND_API_BASE}/api/gsc/quick-wins-context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, pageUrl: pageUrl.trim() }),
    });
    const ctxJson = await ctxRes.json().catch(() => null);
    if (!ctxRes.ok || !ctxJson) return fallback;
    if (Array.isArray(ctxJson.queries) && ctxJson.queries.length) {
      return {
        queries: ctxJson.queries.filter(
          (q: unknown): q is string => typeof q === "string" && q.trim().length > 0,
        ),
        pageUrl,
      };
    }
    if (typeof ctxJson.context === "string") {
      const parsed = parseGscBriefFromContext(ctxJson.context);
      return {
        queries: parsed.queries,
        pageUrl: parsed.pageUrl || pageUrl,
      };
    }
  } catch {
    /* GSC optional */
  }
  return fallback;
}

async function loadSemrushOverviewDoc(filename: string | null): Promise<unknown | null> {
  if (!filename || !BACKEND_API_BASE) return null;
  try {
    const sr = await fetch(
      `${BACKEND_API_BASE}/api/semrush/overview-json/${encodeURIComponent(filename)}`,
    );
    if (sr.ok) return sr.json().catch(() => null);
  } catch {
    /* optional */
  }
  return null;
}

async function uploadSeoBrief(content: string, keyword: string): Promise<string | null> {
  if (!BACKEND_API_BASE) return null;
  return seoBriefSaveLimit(async () => {
    try {
      const saveRes = await fetch(`${BACKEND_API_BASE}/api/overview/seo-brief`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, keyword }),
      });
      const saveJson = await saveRes.json().catch(() => null);
      if (saveRes.ok && saveJson?.storedFile) return String(saveJson.storedFile);
    } catch {
      /* optional */
    }
    return null;
  });
}

function markWave2Skipped(
  input: OverviewResearchRowInput,
  harnessSummaries: ResearchHarnessDoneSummary,
): void {
  harnessSummaries["SERP dump load"] = "Skipped (no SERP file)";
  harnessSummaries["GSC quick-wins context"] = "Skipped (no SERP file)";
  harnessSummaries["Brief merge"] = "Skipped (no SERP file)";
  harnessSummaries["Brief upload"] = "Skipped (no SERP file)";
  emitHarnessSection(input, 3, "done", harnessSummaries["SERP dump load"]);
  emitHarnessSection(input, 4, "done", harnessSummaries["GSC quick-wins context"]);
  emitHarnessSection(input, 5, "done", harnessSummaries["Brief merge"]);
  emitHarnessSection(input, 6, "done", harnessSummaries["Brief upload"]);
}

export type OverviewResearchRowResult = {
  patch: Partial<OverviewRow> | null;
  harnessSummaries?: ResearchHarnessDoneSummary;
};

export async function runOverviewResearchForRow(
  input: OverviewResearchRowInput,
): Promise<OverviewResearchRowResult> {
  const { row, serpDumpUrl } = input;
  const skipGsc = input.skipGsc === true;
  const silent = input.silent === true;
  const harnessSummaries: ResearchHarnessDoneSummary = {};

  const keyword = row.focusKeyword?.trim();
  if (!keyword) {
    if (!silent) notify.error(NOTIFY_COULD_NOT_DERIVE_A_FOCUS_KEYWORD_FOR_THI);
    return { patch: null };
  }

  try {
    const pageUrl = row.url?.trim() ?? "";
    const gscPreset =
      !skipGsc &&
      (input.gscCsvForBatch ?? row.gscQuickWinsCsvFilename ?? input.gscQuickWinsFile ?? null);
    const nextGscForRow = gscPreset
      ? emitGscSectionDone(input, gscPreset, harnessSummaries)
      : null;

    emitHarnessSection(input, 0, "start");

    const wave1Tasks: [
      Promise<Awaited<ReturnType<typeof mcp_DataForSEO_serp_organic_live_advanced>>>,
      Promise<{ storedFile: string | null; errors?: { message?: string }[] } | null>,
      Promise<string | null> | null,
    ] = [
      mcp_DataForSEO_serp_organic_live_advanced({
        keyword,
        location_name: "United States",
        language_code: "en",
        depth: 10,
        people_also_ask_click_depth: 4,
      }).then((result) => {
        const stored =
          (result && (result.stored_file || result.storedFile || result.storedFilename)) || null;
        harnessSummaries["DataForSEO SERP"] = stored
          ? `SERP saved: ${stored}`
          : "SERP call completed (no stored file)";
        emitHarnessSection(input, 0, "done", harnessSummaries["DataForSEO SERP"]);
        return result;
      }),
      runSemrushEnrichment(input, keyword, harnessSummaries),
      nextGscForRow !== null
        ? Promise.resolve(nextGscForRow)
        : resolveGscFilenameForRow(input, harnessSummaries),
    ];

    const [json, semrushRes, resolvedGsc] = await Promise.all(wave1Tasks);
    const gscFilename = resolvedGsc ?? nextGscForRow;

    const storedFile =
      (json && (json.stored_file || json.storedFile || json.storedFilename)) || null;

    let nextSemrushFile = row.semrushJsonFilename ?? null;
    if (semrushRes?.storedFile) {
      nextSemrushFile = semrushRes.storedFile;
    }

    let briefText: string | null = null;
    let briefStored: string | null = null;

    if (storedFile) {
      try {
        const gscFnForBrief = !skipGsc
          ? gscFilename
          : row.gscQuickWinsCsvFilename ?? input.gscQuickWinsFile;

        emitHarnessSection(input, 3, "start");
        emitHarnessSection(input, 4, "start");

        const [serpRes, gscContext, semrushDoc] = await Promise.all([
          fetch(serpDumpUrl(storedFile)).then((res) => {
            harnessSummaries["SERP dump load"] = res.ok
              ? `SERP dump loaded: ${storedFile}`
              : `SERP dump failed (HTTP ${res.status})`;
            emitHarnessSection(input, 3, "done", harnessSummaries["SERP dump load"]);
            return res;
          }),
          gscFnForBrief && pageUrl
            ? loadGscBriefContext(gscFnForBrief, pageUrl).then((ctx) => {
                harnessSummaries["GSC quick-wins context"] =
                  ctx.queries.length > 0
                    ? `${ctx.queries.length} GSC queries`
                    : "No GSC queries for page";
                emitHarnessSection(
                  input,
                  4,
                  "done",
                  harnessSummaries["GSC quick-wins context"],
                );
                return ctx;
              })
            : Promise.resolve({ queries: [] as string[], pageUrl }).then((ctx) => {
                harnessSummaries["GSC quick-wins context"] = "GSC context skipped";
                emitHarnessSection(input, 4, "done", harnessSummaries["GSC quick-wins context"]);
                return ctx;
              }),
          loadSemrushOverviewDoc(nextSemrushFile),
        ]);

        const serpDumpJson = serpRes.ok ? await serpRes.json().catch(() => null) : null;
        if (!serpRes.ok && !silent) {
          notify.warning(
            `Could not load SERP file for the JSON brief (HTTP ${serpRes.status}). Is the API server running and VITE_MCP_API_BASE set if needed?`,
          );
        }

        emitHarnessSection(input, 5, "start");

        if (serpDumpJson && typeof serpDumpJson === "object") {
          const merged = buildMergedSeoContentBrief({
            serpDumpJson,
            pageUrl,
            focusKeyword: keyword,
            gscPageUrl: gscContext.pageUrl,
            gscQueries: gscContext.queries,
            semrushOverviewJson: semrushDoc,
          });
          briefText = JSON.stringify(merged, null, 2);
          harnessSummaries["Brief merge"] = "Brief merged";
        } else {
          harnessSummaries["Brief merge"] =
            serpRes.ok && !silent ? "SERP JSON invalid; brief not built" : "Brief merge skipped";
          if (serpRes.ok && !silent) {
            notify.warning(NOTIFY_SERP_RESPONSE_WAS_NOT_VALID_JSON_JSON_BR);
          }
        }
        emitHarnessSection(input, 5, "done", harnessSummaries["Brief merge"]);

        if (briefText) {
          emitHarnessSection(input, 6, "start");
          briefStored = await uploadSeoBrief(briefText, keyword);
          if (!briefStored && !silent) {
            notify.warning(
              "Could not save SEO brief file on server; brief is still in the grid.",
            );
          }
          harnessSummaries["Brief upload"] = briefStored
            ? `Brief saved: ${briefStored}`
            : "Brief merged (grid only)";
          emitHarnessSection(input, 6, "done", harnessSummaries["Brief upload"]);
        } else {
          harnessSummaries["Brief upload"] = "Brief upload skipped";
          emitHarnessSection(input, 6, "done", harnessSummaries["Brief upload"]);
        }
      } catch {
        harnessSummaries["Brief merge"] = harnessSummaries["Brief merge"] ?? "Brief merge failed";
        harnessSummaries["Brief upload"] = "Brief upload skipped";
        emitHarnessSection(input, 3, "done", harnessSummaries["SERP dump load"] ?? "SERP dump failed");
        emitHarnessSection(
          input,
          4,
          "done",
          harnessSummaries["GSC quick-wins context"] ?? "GSC context failed",
        );
        emitHarnessSection(input, 5, "done", harnessSummaries["Brief merge"]);
        emitHarnessSection(input, 6, "done", harnessSummaries["Brief upload"]);
        if (!silent) {
          notify.warning(NOTIFY_SEO_JSON_BRIEF_MERGE_FAILED_RESEARCH_FIL);
        }
      }
    } else {
      markWave2Skipped(input, harnessSummaries);
    }

    const researchPatch: Partial<OverviewRow> = {
      researchFileName: storedFile,
      semrushJsonFilename: nextSemrushFile,
      ...(!skipGsc ? { gscQuickWinsCsvFilename: gscFilename } : {}),
      ...(briefText ? { seoResearch: briefText } : {}),
      ...(briefStored ? { briefFileName: briefStored } : {}),
    };

    if (!silent) {
      if (storedFile) {
        notify.success(
          briefText ? NOTIFY_DATAFORSEO_SERP_STORED_AND_JSON_CONTENT_ : NOTIFY_SERP_SAVED,
        );
      } else if (briefText) {
        notify.success(NOTIFY_DATAFORSEO_SERP_STORED_AND_JSON_CONTENT_);
      } else {
        notify.warning(NOTIFY_SERP_CALL_COMPLETED_BUT_NO_BRIEF_WAS_SAV);
      }
    } else if (!storedFile && !briefText) {
      throw new Error("SERP research returned no data (no stored file or brief).");
    }
    return { patch: researchPatch, harnessSummaries };
  } catch (err: unknown) {
    const msg =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "DataForSEO research failed.";
    if (!silent) notify.error(notifyErrorMessage(err, "Research failed"));
    throw err instanceof Error ? err : new Error(msg);
  }
}
