import type { WordPressSite } from "@/components/integrations/types";
import { formatDriveMonthSegment, formatDriveYearSegment } from "@/lib/google-drive/google-drive-folder-hierarchy";
import {
  formatGscReportTitleMonthYear,
  formatGscReportTitlePeriod,
} from "@/lib/gsc-reporting/gsc-reporting-document-title";
import { resolveSiteLocationLabel, webSearchCityFromLocation } from "@/lib/llm-audit/resolve-site-location-label";

export type GscClientSeasonContext = {
  city: string;
  locationLabel: string;
  vertical: string;
  calendarMonth: string;
  calendarYear: string;
  /** Current GSC window from the date picker, e.g. April 1, 2026 to August 31, 2026. */
  reportPeriod?: string;
};

export function resolveGscClientSeasonContext(
  site: WordPressSite,
  now: Date = new Date(),
): GscClientSeasonContext {
  const locationLabel = resolveSiteLocationLabel(site).trim();
  const city = webSearchCityFromLocation(locationLabel)?.trim() || "";
  const vertical = String(site.industryVertical ?? "").trim();
  return {
    city,
    locationLabel,
    vertical,
    calendarMonth: formatDriveMonthSegment(now),
    calendarYear: formatDriveYearSegment(now),
  };
}

/** Calendar month/year only; city and vertical empty. Used when the pipeline has no site row. */
export function emptyGscClientSeasonContext(now: Date = new Date()): GscClientSeasonContext {
  return {
    city: "",
    locationLabel: "",
    vertical: "",
    calendarMonth: formatDriveMonthSegment(now),
    calendarYear: formatDriveYearSegment(now),
  };
}

export function formatGscClientSeasonPromptBlock(ctx: GscClientSeasonContext): string {
  const cityLine = ctx.city
    ? `City: ${ctx.city}`
    : "City: not set on the profile. Infer demand season from vertical and the client name only. Do not invent a city name.";
  const locationLine = ctx.locationLabel
    ? `Location: ${ctx.locationLabel}`
    : "Location: not set on the profile.";
  const verticalLine = ctx.vertical
    ? `Vertical: ${ctx.vertical}`
    : "Vertical: not tagged on the profile. Infer the trade from the client name only. Do not invent a city.";
  const periodLabel = ctx.reportPeriod?.trim() || `${ctx.calendarMonth} ${ctx.calendarYear}`;
  const demandLine = ctx.city
    ? "Read whether this trade is usually busy or not busy in this city during that report period."
    : "Read whether this trade is usually busy or not busy during that report period from vertical and client name. Do not invent a city.";
  return [
    "CLIENT_SEASON (profile city + trade; use for demand-season reading only):",
    cityLine,
    locationLine,
    verticalLine,
    `Report period: ${periodLabel} (from the GSC date picker, America/Edmonton).`,
    demandLine,
    "Seasonality sentence (Executive Summary only): exactly one plain sentence that uses the word seasonality and says busy or not busy. If the period covers more than one month, describe that whole window, not only the first month. Do not say shoulder, peak, or slow. Do not invent metrics, weather, or a different city.",
    "Frame GSC movement against that busy or not-busy reading. Apply it to THIS city, vertical, and report period only. Do not copy an example city or trade. Do not invent a city. Do not use today's calendar month if it differs from the report period.",
  ].join("\n");
}

/** Overlay the compare-label month/year so season matches the picker, not "today". */
export function applyReportPeriodToClientSeason(
  ctx: GscClientSeasonContext,
  compareLabel: string,
): GscClientSeasonContext {
  const period = formatGscReportTitlePeriod(compareLabel).trim();
  const monthYear = formatGscReportTitleMonthYear(compareLabel);
  if (!monthYear && !period) return ctx;
  const next: GscClientSeasonContext = period ? { ...ctx, reportPeriod: period } : { ...ctx };
  if (!monthYear) return next;
  const space = monthYear.lastIndexOf(" ");
  const calendarMonth = monthYear.slice(0, space).trim();
  const calendarYear = monthYear.slice(space + 1).trim();
  if (!calendarMonth || !calendarYear) return next;
  return { ...next, calendarMonth, calendarYear };
}

/** Seasonality is stated once in the Executive Summary explainer. Never again. */
export const GSC_SEASONAL_CONTEXT_RULE =
  "**CLIENT SEASON:** The user message includes **CLIENT_SEASON**. Use that **city** (when set), **vertical**, and **REPORT_PERIOD** to read whether this trade is usually **busy** or **not busy**. If city is not set, reason from vertical and client name only; **do not invent a city**. **Say this once:** the Executive Summary explainer includes **exactly one sentence** that uses the word **seasonality** and **busy** or **not busy** for the **full REPORT_PERIOD** (not only the first month). **Forbidden:** **shoulder**, **peak**, **slow**; naming a different month than **REPORT_PERIOD**; a **Season:** bullet; a Seasonal Demand Context heading or section; restating seasonality in Key Insights or any later section; copying an example city or trade. **Do not** invent metrics or weather. Numbers still follow **NUMERIC GROUNDING**.";

/** All sections except Executive Summary. */
export const GSC_NO_SEASON_REPEAT_RULE =
  "**NO SEASON REPEAT:** Do **not** mention seasonality, busy or not-busy demand, or CLIENT_SEASON. Seasonality is stated **once** in the Executive Summary explainer only.";
