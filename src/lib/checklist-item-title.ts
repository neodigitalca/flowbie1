/** Leaf helpers for checklist H2 title extraction (no content-word-blocklist imports). */

export function stripChecklistItemMarkdownHeading(item: string): string {
  let out = item.trim();
  out = out.replace(/^#{1,6}\s+/, "");
  out = out.replace(/^\*\*([^*]+)\*\*:\s*/, "$1: ");
  return out.trim();
}

function extractQuotedTitleAfterColon(rest: string): string | null {
  let tail = rest.trim();
  if (tail.startsWith('"')) {
    const end = tail.indexOf('"', 1);
    if (end > 1) return tail.slice(1, end).trim();
  }
  if (tail.startsWith("'")) {
    const end = tail.indexOf("'", 1);
    if (end > 1) return tail.slice(1, end).trim();
  }
  tail = tail.replace(/\.\s*$/, "").trim();
  return tail || null;
}

function unwrapInstructionBoilerplateTitle(title: string): string {
  const trimmed = title.trim();
  const lower = trimmed.toLowerCase();

  const seoHeaderNeedle = "seo-friendly header:";
  if (lower.startsWith("create ") && lower.includes(seoHeaderNeedle)) {
    const idx = lower.indexOf(seoHeaderNeedle);
    const extracted = extractQuotedTitleAfterColon(trimmed.slice(idx + seoHeaderNeedle.length));
    if (extracted) return extracted;
  }

  const headerNeedle = 'with the header "';
  const headerIdx = lower.indexOf(headerNeedle);
  if (headerIdx >= 0 && lower.startsWith("create ")) {
    const start = headerIdx + headerNeedle.length;
    const end = trimmed.indexOf('"', start);
    if (end > start) {
      return trimmed.slice(start, end).trim();
    }
  }

  const h2Needle = 'create an agent for h2 "';
  if (lower.startsWith(h2Needle)) {
    const start = h2Needle.length;
    const end = trimmed.indexOf('"', start);
    if (end > start) {
      return trimmed.slice(start, end).trim();
    }
  }

  const createAgentForH2Needle = 'create agent for h2 "';
  if (lower.startsWith(createAgentForH2Needle)) {
    const start = createAgentForH2Needle.length;
    const end = trimmed.indexOf('"', start);
    if (end > start) {
      return trimmed.slice(start, end).trim();
    }
  }

  const titledNeedle = 'create an h2 section titled "';
  if (lower.startsWith(titledNeedle)) {
    const start = titledNeedle.length;
    const end = trimmed.indexOf('"', start);
    if (end > start) {
      return trimmed.slice(start, end).trim();
    }
  }

  const agentForNeedle = 'create an h2 section agent for "';
  if (lower.startsWith(agentForNeedle)) {
    const start = agentForNeedle.length;
    const end = trimmed.indexOf('"', start);
    if (end > start) {
      return trimmed.slice(start, end).trim();
    }
  }

  const activeHeaderNeedle = "with an active, seo-friendly header like ";
  if (lower.startsWith("create ") && lower.includes(activeHeaderNeedle)) {
    const idx = lower.indexOf(activeHeaderNeedle);
    const extracted = extractQuotedTitleAfterColon(trimmed.slice(idx + activeHeaderNeedle.length));
    if (extracted) return extracted;
  }

  const h2SectionQuotedNeedle = 'create an agent for the h2 section "';
  if (lower.startsWith(h2SectionQuotedNeedle)) {
    const start = h2SectionQuotedNeedle.length;
    const end = trimmed.indexOf('"', start);
    if (end > start) {
      return trimmed.slice(start, end).trim();
    }
  }

  if (
    lower.startsWith("create ")
    && (lower.includes("for example") || lower.includes("focusing on") || lower.includes("h2 section"))
  ) {
    const quoted = [...trimmed.matchAll(/"([^"]{8,120})"/g)];
    if (quoted.length > 0) {
      return quoted[quoted.length - 1]![1]!.trim();
    }
  }

  return trimmed;
}

/** H2/agent title only — text before the first harness marker ([STRUCTURE], [LINK], etc.). */
export function extractChecklistItemTitle(item: string): string {
  let title = item.trim();
  title = title.replace(/^\d+\.\s*/, "");
  title = stripChecklistItemMarkdownHeading(title);
  const markerStart = title.indexOf("[");
  if (markerStart >= 0) {
    title = title.slice(0, markerStart);
  }
  title = title.replace(/:\s*$/, "").trim();
  title = unwrapInstructionBoilerplateTitle(title);
  return title.trim();
}
