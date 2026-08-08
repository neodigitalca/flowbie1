/** Normalize heading text for FAQ-style detection. */
function normalizeHeadingKey(title: string): string {
  return (title ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

const FAQ_STYLE_EXACT = new Set(["faq", "frequently asked questions"]);

const FAQ_STYLE_PREFIXES = [
  "answering your questions",
  "answers to your questions",
  "your questions answered",
  "common questions",
  "questions about",
  "questions on",
  "questions regarding",
  "q&a",
  "q and a",
];

/** True when a body H2 title duplicates the appended flo-faq section. */
export function isFaqStyleHeadingTitle(title: string): boolean {
  const key = normalizeHeadingKey(title);
  if (!key) return false;
  if (FAQ_STYLE_EXACT.has(key)) return true;
  if (key.startsWith("faq ") || key.endsWith(" faq")) return true;
  for (const prefix of FAQ_STYLE_PREFIXES) {
    if (key === prefix || key.startsWith(`${prefix} `)) return true;
  }
  return false;
}

export function filterOutFaqStyleHeadingTitles(titles: string[]): string[] {
  return titles.filter((t) => !isFaqStyleHeadingTitle(t));
}
