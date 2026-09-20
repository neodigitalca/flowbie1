import { findH2OpenPositions } from "@/lib/overview/overview-blog-overview-prepend";
import { matchHeaderFromList } from "@/lib/overview/overview-blog-scenario-placement-agent";

function normalizeHeadingKey(title: string): string {
  return (title ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function plainInnerFromH2Open(html: string, openAt: number): string {
  const gt = html.indexOf(">", openAt);
  if (gt < 0) return "";
  const close = html.toLowerCase().indexOf("</h2>", gt + 1);
  const inner = close < 0 ? html.slice(gt + 1) : html.slice(gt + 1, close);
  let out = "";
  let inTag = false;
  for (const ch of inner) {
    if (ch === "<") {
      inTag = true;
      continue;
    }
    if (ch === ">") {
      inTag = false;
      continue;
    }
    if (!inTag) out += ch;
  }
  return out.replace(/\s+/g, " ").trim();
}

function h2SectionEndAt(html: string, openAt: number): number {
  const positions = findH2OpenPositions(html);
  for (const pos of positions) {
    if (pos <= openAt) continue;
    return pos;
  }
  return html.length;
}

/** Insert a full scenario H2 section immediately after the chosen anchor H2 section. */
export function insertScenarioSectionAfterH2(
  html: string,
  afterSectionHeader: string,
  scenarioSectionHtml: string,
): string {
  const sectionHtml = scenarioSectionHtml.trim();
  if (!sectionHtml) return html.trim();

  const positions = findH2OpenPositions(html);
  const headers = positions.map((openAt) => plainInnerFromH2Open(html, openAt));
  const anchorHeader =
    matchHeaderFromList(headers, afterSectionHeader) || afterSectionHeader.trim();
  const target = normalizeHeadingKey(anchorHeader);
  if (!target) return html.trim();

  for (const openAt of positions) {
    const label = plainInnerFromH2Open(html, openAt);
    if (normalizeHeadingKey(label) !== target) continue;
    const insertAt = h2SectionEndAt(html, openAt);
    return `${html.slice(0, insertAt).trimEnd()}\n\n${sectionHtml}\n\n${html.slice(insertAt).trimStart()}`.trim();
  }

  return html.trim();
}
