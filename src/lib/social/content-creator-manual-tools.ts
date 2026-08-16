import {
  normalizeContentCalendarRow,
  cellString,
  type ContentCalendarRow,
  type SocialLandingPageSource,
} from "@/lib/social/content-creator-types";
import { isContentCreatorExcludedLandingPage } from "@/lib/social/content-creator-landing-pages";
import type { PpcWpPageContext } from "@/lib/ppc/google-ads-types";

export function assignContentCalendarLandingPages(
  rows: ContentCalendarRow[],
  pages: PpcWpPageContext[],
  landingPageSource: SocialLandingPageSource = "random",
): ContentCalendarRow[] {
  const urls = pages
    .map((p) => (typeof p.url === "string" ? p.url : ""))
    .filter((url) => url.length > 0);
  if (!urls.length) return rows;

  return rows.map((row, index) => {
    const current = cellString(row.landingPageUrl);
    const keepCurrent =
      current.length > 0 && !isContentCreatorExcludedLandingPage({ url: current });
    if (keepCurrent) return row;
    const nextUrl =
      landingPageSource === "random"
        ? urls[Math.floor(Math.random() * urls.length)]!
        : urls[index % urls.length]!;
    return { ...row, landingPageUrl: nextUrl };
  });
}

export function applyManualContentCalendarTools(
  rows: ContentCalendarRow[],
  options: {
    landingPages: PpcWpPageContext[];
    landingPageSource?: SocialLandingPageSource;
  },
): ContentCalendarRow[] {
  return assignContentCalendarLandingPages(
    rows.map(normalizeContentCalendarRow),
    options.landingPages,
    options.landingPageSource ?? "random",
  ).map(normalizeContentCalendarRow);
}
