import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";
import { splitElementorPageHtmlBySections } from "@/lib/elementor-page-content/elementor-page-html";
import {
  extractTextEditorProseFromPageHtml,
  extractTextEditorProseFromRenderedHtml,
  normalizeSectionProseHtml,
  proseLooksCorrupt,
  prosePlainText,
} from "@/lib/elementor-page-content/extract-text-editor-prose";
import {
  parseElementorDataJson,
  parseElementorSectionOutline,
  type ElementorSectionHeader,
} from "@/lib/elementor-page-content/parse-elementor-section-outline";
import { extractH2TextsFromHtml } from "@/lib/overview/overview-blog-headers-extract";

function sectionBodyLength(header: ElementorSectionHeader): number {
  return (header.bodyHtml?.trim() || header.bodyText?.trim() || "").length;
}

/** Prefer the fullest section body available (JSON, saved headers, or rendered post HTML). */
export function richestSectionBodyForOptimize(
  row: OverviewRow,
  section: ElementorSectionHeader,
): ElementorSectionHeader {
  const cachedHeaders = elementorSectionHeadersFromCachedRow(row);
  const titleKey = section.title.trim().toLowerCase();
  const matchIndex = cachedHeaders.findIndex(
    (header) =>
      header.id === section.id ||
      (titleKey && header.title.trim().toLowerCase() === titleKey),
  );
  const pageHtml = row.postContentOptimized?.trim() || row.postContent?.trim() || "";
  const pageProseRaw =
    pageHtml && matchIndex >= 0
      ? extractTextEditorProseFromPageHtml(pageHtml, matchIndex, section.title)
      : "";
  const pageProse = pageProseRaw ? normalizeSectionProseHtml(pageProseRaw) : "";

  const candidates: ElementorSectionHeader[] = [section];
  for (const header of cachedHeaders) {
    if (header.id === section.id || (titleKey && header.title.trim().toLowerCase() === titleKey)) {
      candidates.push({ ...section, ...header, id: section.id, title: section.title || header.title });
    }
  }
  if (pageProse) {
    candidates.push({
      ...section,
      bodyHtml: pageProse,
      bodyText: prosePlainText(pageProse),
    });
  }

  let best = section;
  let bestLen = sectionBodyLength(section);
  for (const candidate of candidates) {
    const len = sectionBodyLength(candidate);
    if (len > bestLen) {
      best = candidate;
      bestLen = len;
    }
  }
  return best;
}

function parseJsonSectionHeaders(rawJson: string): ElementorSectionHeader[] {
  try {
    return parseElementorSectionOutline(parseElementorDataJson(rawJson));
  } catch {
    return [];
  }
}

function sectionBodyEmpty(header: ElementorSectionHeader): boolean {
  return !(header.bodyHtml?.trim() || header.bodyText?.trim());
}

function withNormalizedSectionBodies(headers: ElementorSectionHeader[]): ElementorSectionHeader[] {
  return headers.map((header) => {
    const raw = header.bodyHtml ?? "";
    const bodyHtml = normalizeSectionProseHtml(raw);
    if (!bodyHtml && !raw.trim()) return header;
    if (bodyHtml === raw) return header;
    return {
      ...header,
      bodyHtml,
      bodyText: prosePlainText(bodyHtml),
    };
  });
}

function refreshHeaderProseFromPageHtml(
  headers: ElementorSectionHeader[],
  pageHtml: string,
): ElementorSectionHeader[] {
  if (!pageHtml.trim()) return withNormalizedSectionBodies(headers);
  return headers.map((header, index) => {
    const existingRaw = header.bodyHtml ?? "";
    const existing = normalizeSectionProseHtml(existingRaw);
    const fromPageRaw =
      extractTextEditorProseFromPageHtml(pageHtml, index, header.title) ||
      extractTextEditorProseFromRenderedHtml(existingRaw);
    const fromPage = fromPageRaw ? normalizeSectionProseHtml(fromPageRaw) : "";

    let bodyHtml = existing;
    if (
      fromPage.trim() &&
      (sectionBodyEmpty(header) || proseLooksCorrupt(existingRaw) || proseLooksCorrupt(existing))
    ) {
      bodyHtml = fromPage;
    }

    if (!bodyHtml.trim()) return header;
    if (bodyHtml === existingRaw && !proseLooksCorrupt(existingRaw)) return header;
    return {
      ...header,
      bodyHtml,
      bodyText: prosePlainText(bodyHtml),
    };
  });
}

function htmlSectionHeaders(html: string): ElementorSectionHeader[] {
  const trimmed = html.trim();
  if (!trimmed) return [];

  const fromSplit = splitElementorPageHtmlBySections(trimmed);
  if (fromSplit.length) {
    return fromSplit.map((section, index) => {
      const title = section.title.trim();
      const prose = extractTextEditorProseFromPageHtml(trimmed, index, title);
      return {
        id: `html-section-${index}`,
        title,
        hasHeadingWidget: false,
        headingInBodyHtml: true,
        headingHtml: `<h2>${title}</h2>`,
        depth: 0,
        bodyText: prosePlainText(prose),
        bodyHtml: prose,
      };
    });
  }

  return extractH2TextsFromHtml(trimmed).filter((title) => title.trim()).map((title, index) => ({
    id: `cached-h2-${index}`,
    title,
    hasHeadingWidget: false,
    headingInBodyHtml: false,
    headingHtml: "",
    depth: 0,
    bodyText: "",
    bodyHtml: "",
  }));
}

/** Section outline from row cache only: JSON, saved headers, or bulk inventory HTML. No network. */
export function elementorSectionHeadersFromCachedRow(row: OverviewRow): ElementorSectionHeader[] {
  const pageHtml = row.postContentOptimized?.trim() || row.postContent?.trim() || "";
  const fromJson = row.elementorDataJson?.trim()
    ? parseJsonSectionHeaders(row.elementorDataJson.trim())
    : [];

  let headers: ElementorSectionHeader[];
  if (fromJson.length) {
    return withNormalizedSectionBodies(fromJson);
  } else if (row.elementorSectionHeaders?.length) {
    headers = row.elementorSectionHeaders as ElementorSectionHeader[];
  } else if (pageHtml) {
    headers = htmlSectionHeaders(pageHtml);
  } else {
    const h2s = row.blogH2List ?? [];
    return h2s.map((title, index) => ({
      id: `cached-h2-${index}`,
      title,
      hasHeadingWidget: false,
      headingInBodyHtml: false,
      headingHtml: "",
      depth: 0,
      bodyText: "",
      bodyHtml: "",
    }));
  }

  return pageHtml ? refreshHeaderProseFromPageHtml(headers, pageHtml) : withNormalizedSectionBodies(headers);
}

/** Stamp cached section headers onto Pages rows after bulk inventory merge. */
export function applyCachedElementorFieldsToOverviewRows(
  rows: OverviewRow[],
  source: OverviewSitemapSource,
): OverviewRow[] {
  if (source !== "pages") return rows;

  return rows.map((row) => {
    const pageHtml = row.postContentOptimized?.trim() || row.postContent?.trim() || "";
    const headers = elementorSectionHeadersFromCachedRow(row);
    if (!headers.length) return row;

    const blogH2List = headers.map((section) => section.title).filter(Boolean);
    const hasJson = Boolean(row.elementorDataJson?.trim());
    const refreshed =
      pageHtml && !hasJson ? refreshHeaderProseFromPageHtml(headers, pageHtml) : headers;
    return {
      ...row,
      contentFormat: row.contentFormat ?? "elementor",
      elementorSectionHeaders: refreshed,
      blogH2List: row.blogH2List?.length ? row.blogH2List : blogH2List,
    };
  });
}
