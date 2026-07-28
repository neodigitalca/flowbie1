import { isValidImageUrl, isValidMediaUrl } from "./images-extract";

/**
 * Extracts H2 section headings from markdown or HTML content.
 */
export function extractH2Headings(markdownContent: string): string[] {
  if (!markdownContent) return [];
  const headings: string[] = [];
  // HTML: <h2>Title</h2> or <h2 ...>Title</h2>
  const htmlMatches = markdownContent.matchAll(/<h2[^>]*>([^<]+)<\/h2>/gi);
  for (const m of htmlMatches) {
    if (m[1]?.trim()) headings.push(m[1].trim());
  }
  if (headings.length > 0) return headings;
  // Markdown: ## Title
  for (const line of markdownContent.split("\n")) {
    const match = line.match(/^##\s+(.+)$/);
    if (match?.[1]) headings.push(match[1].trim());
  }
  return headings;
}

/**
 * Inserts a media citation as a text link only (no <img> / iframe embed).
 * OpenRouter picks the section; this places the link after the first paragraph in that H2.
 */
export function insertMediaLinkIntoSection(
  markdownContent: string,
  sectionHeading: string,
  mediaUrl: string,
  linkLabel: string
): string {
  if (!markdownContent || !sectionHeading) return markdownContent;
  if (!mediaUrl?.trim() || !isValidMediaUrl(mediaUrl)) return markdownContent;
  const label = (linkLabel ?? "").trim();
  if (!label) return markdownContent;

  const safeHref = mediaUrl.replace(/"/g, "&quot;");
  const safeLabel = label.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const searchStart = sectionHeading.toLowerCase().substring(0, Math.min(30, sectionHeading.length));

  if (/<h2[\s>]/i.test(markdownContent)) {
    const h2Re = new RegExp(`(<h2[^>]*>)([^<]*${escapeRe(searchStart)}[^<]*)(<\\/h2>)`, "i");
    const m = markdownContent.match(h2Re);
    if (m) {
      const afterH2 = markdownContent.indexOf(m[0]) + m[0].length;
      const nextP = markdownContent.indexOf("</p>", afterH2);
      const insertAt = nextP > 0 ? nextP + 4 : afterH2;
      const linkHtml = `<p><a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeLabel}</a></p>`;
      return markdownContent.slice(0, insertAt) + linkHtml + markdownContent.slice(insertAt);
    }
    return (
      markdownContent +
      `<p><a href="${safeHref}" target="_blank" rel="noopener noreferrer">${safeLabel}</a></p>`
    );
  }

  const linkMarkdown = `[${label.replace(/[\[\]]/g, "")}](${mediaUrl})`;
  const lines = markdownContent.split("\n");
  let insertIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^##\s+/) && lines[i].toLowerCase().includes(searchStart)) {
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() !== "") {
          insertIndex = j + 1;
          break;
        }
      }
      break;
    }
  }

  if (insertIndex === -1) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`## ${sectionHeading}`)) {
        insertIndex = i + 2;
        break;
      }
    }
  }

  if (insertIndex === -1) return markdownContent + "\n\n" + linkMarkdown;

  lines.splice(insertIndex, 0, "", linkMarkdown, "");
  return lines.join("\n");
}

/**
 * @deprecated Prefer insertMediaLinkIntoSection (link-only preservation).
 * Kept for callers that still want an embedded image tag.
 */
export function insertImageIntoSection(
  markdownContent: string,
  sectionHeading: string,
  imageUrl: string,
  altTag: string
): string {
  if (!markdownContent || !sectionHeading) return markdownContent;
  if (!imageUrl?.trim() || !isValidImageUrl(imageUrl)) return markdownContent;
  const trimmedAltTag = (altTag ?? "").trim();
  if (!trimmedAltTag) return markdownContent;

  const searchStart = sectionHeading.toLowerCase().substring(0, Math.min(30, sectionHeading.length));

  if (/<h2[\s>]/i.test(markdownContent)) {
    const h2Re = new RegExp(`(<h2[^>]*>)([^<]*${escapeRe(searchStart)}[^<]*)(<\\/h2>)`, "i");
    const m = markdownContent.match(h2Re);
    if (m) {
      const afterH2 = markdownContent.indexOf(m[0]) + m[0].length;
      const nextP = markdownContent.indexOf("</p>", afterH2);
      const insertAt = nextP > 0 ? nextP + 4 : afterH2;
      const imgHtml = `<p><img src="${imageUrl}" alt="${trimmedAltTag.replace(/"/g, "&quot;")}" loading="lazy" /></p>`;
      return markdownContent.slice(0, insertAt) + imgHtml + markdownContent.slice(insertAt);
    }
    return markdownContent + `<p><img src="${imageUrl}" alt="${trimmedAltTag.replace(/"/g, "&quot;")}" loading="lazy" /></p>`;
  }

  const imageMarkdown = `![${trimmedAltTag}](${imageUrl})`;
  const lines = markdownContent.split("\n");
  let insertIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^##\s+/) && lines[i].toLowerCase().includes(searchStart)) {
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() !== "") {
          insertIndex = j + 1;
          break;
        }
      }
      break;
    }
  }

  if (insertIndex === -1) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`## ${sectionHeading}`)) {
        insertIndex = i + 2;
        break;
      }
    }
  }

  if (insertIndex === -1) return markdownContent + "\n\n" + imageMarkdown;

  lines.splice(insertIndex, 0, "", imageMarkdown, "");
  return lines.join("\n");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
