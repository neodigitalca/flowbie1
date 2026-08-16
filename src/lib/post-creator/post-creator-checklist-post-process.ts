/**
 * Checklist parse/enforce (shared by Generator + server parity tests).
 */
import {
  isFaqStyleHeadingTitle,
  sanitizeForbiddenWordsInChecklistItem,
} from "@/lib/content-word-blocklist";

export function stripChecklistItemMarkdownHeading(item: string): string {
  let out = item.trim();
  out = out.replace(/^#{1,6}\s+/, "");
  out = out.replace(/^\*\*([^*]+)\*\*:\s*/, "$1: ");
  return out.trim();
}

export function isBoldOnlyChecklistLine(item: string): boolean {
  const t = item.trim();
  return /^\*\*[^*]+\*\*:\s*.+$/.test(t) && !/\[(TABLE|LIST|LINK|STRUCTURE|EXACT)/i.test(t);
}

export function parseBlogTemplateChecklistRaw(aiResponse: string): string[] {
  const lines = aiResponse.split("\n");
  const checklist: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(?:\d+\.|\-|\*)\s+(.+)$/);
    if (match?.[1]) {
      const item = stripChecklistItemMarkdownHeading(match[1].trim());
      if (item && !isBoldOnlyChecklistLine(item)) {
        checklist.push(item);
      }
    }
  }

  if (checklist.length === 0) {
    return lines
      .map((line) => stripChecklistItemMarkdownHeading(line.trim()))
      .filter((line) => line.length > 10 && !line.startsWith("#") && !isBoldOnlyChecklistLine(line))
      .slice(0, 10);
  }

  return checklist;
}

export function validateAndEnforceMandatoryElements(checklist: string[]): string[] {
  if (checklist.length === 0) {
    return checklist;
  }

  const joined = checklist.join("\n").toLowerCase();
  const out = [...checklist];

  if (!joined.includes("[table]")) {
    const idx = Math.min(1, out.length - 1);
    out[idx] += " [TABLE]: compact comparison table.";
  }
  if (!joined.includes("[list]: bullet") && !joined.includes("[list]:bullet")) {
    const idx = Math.min(1, out.length - 1);
    out[idx] += " [LIST]: bullet summary of benefits.";
  }
  if (!joined.includes("[list]: number") && !joined.includes("[list]:number")) {
    const idx = Math.min(3, out.length - 1);
    out[idx] += " [LIST]: number step-by-step process.";
  }

  return out;
}

export function prepareChecklistForPipeline(checklist: string[]): string[] {
  return checklist
    .map(sanitizeForbiddenWordsInChecklistItem)
    .filter((item) => {
      if (!item) return false;
      for (const match of item.matchAll(/"([^"]+)"/g)) {
        if (isFaqStyleHeadingTitle(match[1] ?? "")) return false;
      }
      if (/\[FAQ\]/i.test(item)) return false;
      return true;
    });
}

export function formatChecklistNumberedLines(checklist: string[]): string[] {
  return checklist.map((item, index) => `${index + 1}. ${item}`);
}

export function parseBlogTemplateChecklist(aiResponse: string): string[] {
  const parsed = parseBlogTemplateChecklistRaw(aiResponse);
  const enforced = validateAndEnforceMandatoryElements(parsed);
  return prepareChecklistForPipeline(enforced);
}
