/**
 * Strips trailing " | Brand Name" and generic pipe suffixes from SAP page titles.
 * Models often append the business name after a pipe; we never want that suffix.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Remove everything from the first " | " onward (any hallucinated brand suffix). */
export function stripTitlePipeSuffix(title: string): string {
  const t = (title ?? "").trim();
  const pipeIdx = t.indexOf(" | ");
  if (pipeIdx > 0) return t.slice(0, pipeIdx).trim();
  return t;
}

export function stripPipeBrandSuffixFromTitle(title: string, brandName: string | undefined | null): string {
  const t = (title ?? "").trim();
  const brand = (brandName ?? "").trim();
  if (!t || !brand) return t;
  const re = new RegExp(`\\s*\\|\\s*${escapeRegex(brand)}\\s*$`, "i");
  return t.replace(re, "").trim();
}

export function sanitizeSapPageTitle(title: string, brandName?: string | null): string {
  return stripPipeBrandSuffixFromTitle(stripTitlePipeSuffix(title), brandName);
}
