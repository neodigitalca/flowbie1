/**
 * Vulgar/profane GSC queries must never enter SAP keywords, titles, or JSON link payloads.
 */

const OFFENSIVE_WORDS = [
  "shit",
  "shite",
  "fuck",
  "fucking",
  "fucker",
  "fucked",
  "motherfucker",
  "bitch",
  "bastard",
  "cunt",
  "dick",
  "cock",
  "pussy",
  "piss",
  "pissed",
  "whore",
  "slut",
  "twat",
  "wank",
  "wanker",
  "bollocks",
  "arsehole",
  "asshole",
  "ass",
  "douche",
  "douchebag",
  "cum",
  "cumming",
  "jizz",
  "tits",
  "titty",
  "nigger",
  "nigga",
  "faggot",
  "fag",
  "retard",
];

const OFFENSIVE_PATTERNS = OFFENSIVE_WORDS.map(
  (word) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
);

/** Collapse obfuscated vulgar tokens (f*ck, sh*t, a$$) before word-boundary checks. */
export function normalizeGscOffensiveText(text: string): string {
  return text
    .toLowerCase()
    .replace(/f\*+c+k/gi, "fuck")
    .replace(/sh\*+t/gi, "shit")
    .replace(/a\*+s/gi, "ass")
    .replace(/[@$]/g, "s")
    .replace(/[*_]+/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when text contains a vulgar/profane whole word (after obfuscation normalization). */
export function containsOffensiveGscLanguage(text: string): boolean {
  const normalized = normalizeGscOffensiveText(text);
  if (!normalized) return false;
  return OFFENSIVE_PATTERNS.some((pattern) => pattern.test(normalized));
}

/** GSC query gate used by bulk SAP and optimizer keyword pickers. */
export function isOffensiveGscQuery(query: string): boolean {
  return containsOffensiveGscLanguage(query);
}
