import {
  applyBodyHtmlToBand,
  applyHeaderToBand,
  cloneElementorData,
} from "@/lib/elementor-page-content/elementor-band-edit";
import {
  parseElementorDataJson,
  parseElementorSectionOutline,
} from "@/lib/elementor-page-content/parse-elementor-section-outline";

type ElementorNode = {
  id?: string;
  elType?: string;
  elements?: ElementorNode[];
};

function isTopLevelBand(node: ElementorNode): boolean {
  const t = node.elType;
  return t === "container" || t === "section";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtml(raw: string): string {
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function buildElementorPageHtml(elementorJson: string): string {
  const sections = parseElementorSectionOutline(parseElementorDataJson(elementorJson));
  if (!sections.length) return "";
  return sections
    .map((section) => {
      if (section.headingInBodyHtml && section.headingHtml.trim()) {
        const body =
          section.bodyHtml?.trim() ||
          (section.bodyText?.trim() ? `<p>${escapeHtml(section.bodyText.trim())}</p>` : "");
        return body ? `${section.headingHtml.trim()}\n${body}`.trim() : section.headingHtml.trim();
      }
      const title = escapeHtml(section.title.trim() || "Section");
      const body =
        section.bodyHtml?.trim() ||
        (section.bodyText?.trim() ? `<p>${escapeHtml(section.bodyText.trim())}</p>` : "");
      return `<h2>${title}</h2>\n${body}`.trim();
    })
    .join("\n\n");
}

export function splitElementorPageHtmlBySections(
  pageHtml: string,
): Array<{ title: string; bodyHtml: string }> {
  const html = pageHtml.trim();
  if (!html) return [];

  const re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  const matches = [...html.matchAll(re)];
  if (!matches.length) {
    return [];
  }

  const sections: Array<{ title: string; bodyHtml: string }> = [];
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i]!;
    const title = stripHtml(match[1] ?? "");
    if (!title) continue;
    const bodyStart = match.index! + match[0].length;
    const bodyEnd = i + 1 < matches.length ? matches[i + 1]!.index! : html.length;
    sections.push({
      title,
      bodyHtml: html.slice(bodyStart, bodyEnd).trim(),
    });
  }
  return sections;
}

export function applyElementorPageHtmlToJson(elementorJson: string, pageHtml: string): string {
  const data = cloneElementorData(parseElementorDataJson(elementorJson)) as ElementorNode[];
  const parsedSections = splitElementorPageHtmlBySections(pageHtml);
  let sectionIndex = 0;

  for (const node of data) {
    if (!node || typeof node !== "object" || !isTopLevelBand(node)) continue;
    const slice = parsedSections[sectionIndex];
    if (!slice) break;
    if (slice.title.trim()) applyHeaderToBand(node, slice.title.trim());
    if (slice.bodyHtml.trim()) applyBodyHtmlToBand(node, slice.bodyHtml.trim());
    sectionIndex += 1;
  }

  return JSON.stringify(data);
}
