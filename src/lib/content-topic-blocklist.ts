/**
 * Global content-topic blocklist for optimizer + generator (prompts + deterministic filters).
 * Single source of truth for irrelevant brands/topics that must never become keywords, titles, or ideas.
 */

/** Phrases / brands permanently excluded from content optimizer and generator. */
export const GLOBAL_BLOCKED_TOPIC_PHRASES = ["bali blinds", "bali blind"] as const;

function normalizeTopicText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True when any part mentions Bali Blinds (or DIY remove/detach/uninstall of Bali).
 * Use for keywords, titles, URLs, GSC queries, and checklist rows.
 */
export function isBlockedContentTopicPhrase(...parts: (string | undefined | null)[]): boolean {
  const combined = normalizeTopicText(parts.filter(Boolean).join(" "));
  if (!combined.includes("bali")) return false;
  if (/\bbali\s+blinds?\b/.test(combined)) return true;
  if (
    /\b(remove|removal|removing|detach|uninstall|diy)\b/.test(combined) &&
    /\bbali\b/.test(combined)
  ) {
    return true;
  }
  return false;
}

/** Inject into system/user prompts for bulk ideas, keyword research, and optimization. */
export const GLOBAL_BLOCKED_TOPIC_PROMPT_BLOCK = `TOPIC BLOCKLIST (mandatory — content optimizer and generator):
- Never propose keywords, titles, headings, meta, or body content about **Bali Blinds** (any casing, word order, or fuzzy variant: "bali blinds", "Bali Blind", "blinds bali", removal/DIY angles, etc.).
- Never propose DIY remove/detach/uninstall/how-to-remove content for Bali blinds.
- If a source query or URL targets Bali blinds, drop it and pick a different relevant topic with zero "Bali" in keyword and title.
- Treat the site's own trading / company name the same way: reject fuzzy matches and word reorders of that trading name only (e.g. "Blind Magic" ↔ "Magic Blinds"). Do not reject normal product keywords or manufacturer lines the dealer sells.`;
