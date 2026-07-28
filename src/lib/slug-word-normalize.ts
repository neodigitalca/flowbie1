/** Straight and curly apostrophes — strip before slug word splitting so "Alberta's" → "albertas", not "alberta-s". */
const APOSTROPHE_CHARS_RE = /[''´`]/g;

export function stripApostrophesForSlug(value: string): string {
  return value.replace(APOSTROPHE_CHARS_RE, "");
}
