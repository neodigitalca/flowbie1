import { normalizeInternalUrl } from "@/lib/wordpress-api/validate-internal-links";
import type { ExtraTextInventoryLinkRow } from "@/lib/content-generation/extra-text-inventory-links";

const OFFER_TABLE_FIRST_COL = /product category|service product name|service name|product name|what we offer/i;

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function matchPageForLabel(
  label: string,
  pages: ExtraTextInventoryLinkRow[],
): ExtraTextInventoryLinkRow | null {
  const norm = normalizeLabel(label);
  if (!norm) return null;

  let best: { page: ExtraTextInventoryLinkRow; score: number } | null = null;
  for (const page of pages) {
    const titleNorm = normalizeLabel(page.title || page.slug);
    const slugNorm = normalizeLabel(page.slug.replace(/-/g, " "));
    let score = 0;
    if (titleNorm === norm) score = 100;
    else if (titleNorm.includes(norm) || norm.includes(titleNorm)) score = 85;
    else if (slugNorm.includes(norm) || norm.includes(slugNorm)) score = 75;

    const labelWords = norm.split(/\s+/).filter((w) => w.length > 2);
    const titleWords = new Set(titleNorm.split(/\s+/));
    const overlap = labelWords.filter((w) => titleWords.has(w)).length;
    score = Math.max(score, overlap * 25);

    if (!best || score > best.score) best = { page, score };
  }

  return best && best.score >= 50 ? best.page : null;
}

function isOfferTable(tableHtml: string): boolean {
  const headerMatch = tableHtml.match(/<th[^>]*>([\s\S]*?)<\/th>/i);
  if (!headerMatch) return false;
  return OFFER_TABLE_FIRST_COL.test(normalizeLabel(headerMatch[1] ?? ""));
}

function upsertLinkInCell(cellHtml: string, page: ExtraTextInventoryLinkRow): string {
  const title = (page.title || page.slug).trim();
  const href = page.link.trim();
  const safeHref = escapeHtmlAttr(href);
  const safeTitle = escapeHtmlAttr(title);

  const anchorMatch = cellHtml.match(/<a\b([^>]*)>([\s\S]*?)<\/a>/i);
  if (anchorMatch) {
    const attrs = anchorMatch[1] ?? "";
    const inner = anchorMatch[2] ?? "";
    const withoutTitle = attrs.replace(/\s+title\s*=\s*("[^"]*"|'[^']*')/i, "");
    const withoutHref = withoutTitle.replace(/\s+href\s*=\s*("[^"]*"|'[^']*')/i, "");
    return `<a href="${safeHref}" title="${safeTitle}"${withoutHref}>${inner}</a>`;
  }

  const plain = cellHtml.replace(/<[^>]+>/g, "").trim() || title;
  return `<a href="${safeHref}" title="${safeTitle}">${plain}</a>`;
}

function processOfferTable(
  tableHtml: string,
  pages: ExtraTextInventoryLinkRow[],
  currentPageUrl: string,
  siteUrl: string,
): string {
  const allowedPageUrls = new Set(
    pages.map((p) => normalizeInternalUrl(siteUrl, p.link)).filter(Boolean),
  );
  const normCurrent = normalizeInternalUrl(siteUrl, currentPageUrl);
  let assignIndex = 0;

  const pickPageForRow = (label: string, cellHtml: string): ExtraTextInventoryLinkRow | null => {
    const hrefMatch = cellHtml.match(/href\s*=\s*("([^"]*)"|'([^']*)')/i);
    const existingHref = (hrefMatch?.[2] || hrefMatch?.[3] || "").trim();
    const existingNorm = normalizeInternalUrl(siteUrl, existingHref);

    if (existingNorm && allowedPageUrls.has(existingNorm)) {
      return pages.find((p) => normalizeInternalUrl(siteUrl, p.link) === existingNorm) ?? null;
    }

    const matched = matchPageForLabel(label, pages);
    if (matched?.link?.trim()) {
      const matchedNorm = normalizeInternalUrl(siteUrl, matched.link);
      if (matchedNorm && matchedNorm !== normCurrent) return matched;
    }

    for (let n = 0; n < pages.length; n++) {
      const candidate = pages[(assignIndex + n) % pages.length];
      if (!candidate?.link?.trim()) continue;
      assignIndex += 1;
      const candidateNorm = normalizeInternalUrl(siteUrl, candidate.link);
      if (candidateNorm && candidateNorm !== normCurrent) return candidate;
    }

    return null;
  };

  return tableHtml.replace(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i, (_full, body: string) => {
    const rows = body.replace(
      /<tr[^>]*>([\s\S]*?)<\/tr>/gi,
      (rowFull: string, rowInner: string) => {
        const cells = [...rowInner.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
        if (!cells.length) return rowFull;

        const firstCell = cells[0];
        const cellHtml = firstCell[1] ?? "";
        const label = cellHtml.replace(/<[^>]+>/g, "").trim();
        const page = pickPageForRow(label, cellHtml);
        if (!page?.link?.trim()) return rowFull;

        const linked = upsertLinkInCell(cellHtml, page);
        const newRowInner = rowInner.replace(firstCell[0], firstCell[0].replace(cellHtml, linked));
        return rowFull.replace(rowInner, newRowInner);
      },
    );
    return `<tbody>${rows}</tbody>`;
  });
}

/** Entity SAP: link Product Category / Service Name cells to pages bucket URLs with title attributes. */
export function ensureWhatWeOfferTablePageLinks(
  html: string,
  pages: ExtraTextInventoryLinkRow[],
  currentPageUrl: string,
  siteUrl: string,
): string {
  if (!html?.trim() || !pages.length) return html;

  const tablePattern = /<table[\s\S]*?<\/table>/gi;
  let out = html;
  let match: RegExpExecArray | null;
  tablePattern.lastIndex = 0;

  while ((match = tablePattern.exec(html)) !== null) {
    const tableHtml = match[0];
    if (!isOfferTable(tableHtml)) continue;
    const fixed = processOfferTable(tableHtml, pages, currentPageUrl || siteUrl, siteUrl);
    if (fixed !== tableHtml) {
      out = out.replace(tableHtml, fixed);
    }
  }

  return out;
}
