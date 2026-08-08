/** Deterministic canonical punctuation for focus keywords at prompt-build time. */

type CompoundRule = {
  /** Lowercase tokens joined by space (e.g. "x ray"). */
  pattern: string;
  replacement: string;
};

const COMPOUND_RULES: CompoundRule[] = [
  { pattern: "x ray", replacement: "X-ray" },
  { pattern: "x rays", replacement: "X-rays" },
  { pattern: "xray", replacement: "X-ray" },
  { pattern: "xrays", replacement: "X-rays" },
  { pattern: "e mail", replacement: "e-mail" },
  { pattern: "e commerce", replacement: "e-commerce" },
  { pattern: "ecommerce", replacement: "e-commerce" },
  { pattern: "co working", replacement: "co-working" },
  { pattern: "coworking", replacement: "co-working" },
  { pattern: "covid 19", replacement: "COVID-19" },
];

function splitTokens(phrase: string): string[] {
  return phrase.trim().split(/\s+/).filter(Boolean);
}

function joinTokens(tokens: string[]): string {
  return tokens.join(" ");
}

function matchCompoundAt(tokens: string[], start: number, pattern: string): number | null {
  const parts = pattern.split(" ");
  if (start + parts.length > tokens.length) return null;
  for (let i = 0; i < parts.length; i++) {
    if (tokens[start + i]!.toLowerCase() !== parts[i]) return null;
  }
  return parts.length;
}

function preserveTokenCasing(original: string, replacement: string): string {
  if (!original) return replacement;
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] === original[0]?.toUpperCase()) {
    return replacement[0]!.toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/**
 * Applies standard editorial hyphenation/punctuation to a stored focus keyword phrase.
 * Same words and order; only canonicalizes known compounds (X-ray, e-commerce, etc.).
 */
export function applyCanonicalKeywordPunctuation(stored: string): string {
  const trimmed = stored.trim();
  if (!trimmed) return trimmed;

  const tokens = splitTokens(trimmed);
  const out: string[] = [];
  let i = 0;

  while (i < tokens.length) {
    let matched = false;
    for (const rule of COMPOUND_RULES) {
      const span = matchCompoundAt(tokens, i, rule.pattern);
      if (span == null) continue;
      const originalSlice = tokens.slice(i, i + span);
      const originalJoined = joinTokens(originalSlice);
      out.push(preserveTokenCasing(originalJoined, rule.replacement));
      i += span;
      matched = true;
      break;
    }
    if (!matched) {
      out.push(tokens[i]!);
      i += 1;
    }
  }

  return joinTokens(out);
}

const KEYWORD_PUNCTUATION_RULES = `**KEYWORD PUNCTUATION (MANDATORY)**:
- When a compound has a standard hyphenated editorial form (X-ray, e-commerce, COVID-19), you **must** use that form in all generated copy (titles, headings, body, FAQ).
- Keep the same **words and word order** as the focus keyword; only add standard hyphens or punctuation where editorially required.
- **Forbidden:** collapsing to one word (Xray), decorative punctuation (vs., colons inside the keyword phrase), or inventing hyphens on ordinary words.
- **Do not** change ACF keyword_focus values; this applies only to generated content you write.`;

/**
 * Prompt block injected into harness/title/extra-text prompts.
 */
export function buildKeywordPunctuationPromptBlock(stored: string, writing?: string): string {
  const storedTrim = stored.trim();
  if (!storedTrim) return "";

  const writingForm = (writing ?? applyCanonicalKeywordPunctuation(storedTrim)).trim();
  if (writingForm.toLowerCase() === storedTrim.toLowerCase()) {
    return `\n=== KEYWORD PUNCTUATION ===\n${KEYWORD_PUNCTUATION_RULES}\nFocus keyword: "${storedTrim}"\n=== END KEYWORD PUNCTUATION ===`;
  }

  return `\n=== KEYWORD PUNCTUATION ===
STORED FOCUS KEYWORD (ACF — do not rewrite this field): "${storedTrim}"
WRITING KEYWORD (use in titles, headings, body, FAQ): "${writingForm}"
${KEYWORD_PUNCTUATION_RULES}
=== END KEYWORD PUNCTUATION ===`;
}

/** Returns writing keyword for prompt injection (canonical punctuation applied). */
export function resolveWritingKeyword(stored: string, writingOverride?: string): string {
  const storedTrim = stored.trim();
  if (!storedTrim) return "";
  if (writingOverride?.trim()) return writingOverride.trim();
  return applyCanonicalKeywordPunctuation(storedTrim);
}
