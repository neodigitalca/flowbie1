/**
 * Extract plain text from DataForSEO on_page/content_parsing/live JSON response.
 * Mirrors patterns in server/company-scraper-helpers.js (content_parsing_element, page_as_markdown).
 */

const DEFAULT_MAX_CHARS = 18_000;

function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((item) => extractTextFromContent(item)).join(" ");
  }
  if (content && typeof content === "object") {
    const o = content as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
    if (o.content !== undefined) return extractTextFromContent(o.content);
    if (typeof o.value === "string" || typeof o.value === "number") return String(o.value);
    const texts = Object.values(o)
      .map((val) => extractTextFromContent(val))
      .filter((t) => typeof t === "string" && t.trim().length > 0);
    return texts.join(" ");
  }
  return "";
}

function collectFromItems(items: unknown[]): string[] {
  const parts: string[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const it = item as Record<string, unknown>;
    if (it.page_as_markdown && typeof it.page_as_markdown === "string") {
      parts.push(it.page_as_markdown);
      continue;
    }
    if (it.type === "content_parsing_element" && it.page_content && typeof it.page_content === "object") {
      const pc = it.page_content as Record<string, unknown>;
      if (pc.header) parts.push(extractTextFromContent(pc.header));
      if (pc.primary_content) parts.push(extractTextFromContent(pc.primary_content));
    }
  }
  return parts;
}

/**
 * Walk `tasks[0].result` and concatenate readable text. Caps length for LLM input.
 */
export function extractPlainTextFromOnPageDfsResponse(
  root: unknown,
  maxChars: number = DEFAULT_MAX_CHARS,
): string {
  const r = root as {
    tasks?: Array<{
      status_code?: number;
      result?: unknown[];
    }>;
  };
  const t0 = r.tasks?.[0];
  if (t0?.status_code != null && t0.status_code !== 20000) {
    return "";
  }
  const resultBlock = t0?.result;
  const textParts: string[] = [];

  if (Array.isArray(resultBlock)) {
    for (const resultItem of resultBlock) {
      if (!resultItem || typeof resultItem !== "object") continue;
      const items = (resultItem as { items?: unknown[] }).items;
      if (Array.isArray(items)) {
        textParts.push(...collectFromItems(items));
      }
    }
  } else if (resultBlock && typeof resultBlock === "object" && !Array.isArray(resultBlock)) {
    const items = (resultBlock as { items?: unknown[] }).items;
    if (Array.isArray(items)) {
      textParts.push(...collectFromItems(items));
    }
  }

  let out = textParts.filter(Boolean).join("\n\n").replace(/\s+/g, " ").trim();
  if (out.length > maxChars) {
    out = `${out.slice(0, maxChars)}…`;
  }
  return out;
}

/**
 * Best-effort document title from DataForSEO content_parsing (meta title when present).
 */
export function extractPageTitleFromOnPageDfsResponse(root: unknown): string {
  const r = root as {
    tasks?: Array<{
      status_code?: number;
      result?: unknown[];
    }>;
  };
  const t0 = r.tasks?.[0];
  if (t0?.status_code != null && t0.status_code !== 20000) {
    return "";
  }
  const blocks = t0?.result;
  if (!Array.isArray(blocks)) return "";

  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const items = (block as { items?: unknown[] }).items;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const it = item as Record<string, unknown>;
      if (it.type !== "content_parsing_element" || !it.page_content || typeof it.page_content !== "object") {
        continue;
      }
      const pc = it.page_content as Record<string, unknown>;
      const meta = pc.meta;
      if (meta && typeof meta === "object") {
        const m = meta as Record<string, unknown>;
        if (typeof m.title === "string" && m.title.trim()) {
          return m.title.trim().slice(0, 500);
        }
      }
    }
  }
  return "";
}
