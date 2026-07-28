/**
 * Generate Local Image: which pages to process relative to an existing body image.
 * - new: only pages without a Local Image (default)
 * - old: only pages that already have one (replace)
 * - all: every page (strip then insert when present)
 */
export type LocalImageExistingScope = "new" | "old" | "all";

export function normalizeLocalImageExistingScope(
  value: LocalImageExistingScope | undefined,
): LocalImageExistingScope {
  if (value === "old" || value === "all") return value;
  return "new";
}

export type LocalImageExistingGate =
  | { action: "generate"; stripExisting: boolean }
  | { action: "skip"; reason: string };

/** Decide skip vs generate/replace from scope + whether HTML already has a Local Image. */
export function gateLocalImageExistingScope(
  scope: LocalImageExistingScope | undefined,
  hasExistingImage: boolean,
): LocalImageExistingGate {
  const normalized = normalizeLocalImageExistingScope(scope);
  if (normalized === "new") {
    if (hasExistingImage) {
      return {
        action: "skip",
        reason: "Skipped — Local Image already present on this page.",
      };
    }
    return { action: "generate", stripExisting: false };
  }
  if (normalized === "old") {
    if (!hasExistingImage) {
      return {
        action: "skip",
        reason: "Skipped — no Local Image to replace on this page.",
      };
    }
    return { action: "generate", stripExisting: true };
  }
  // all
  return { action: "generate", stripExisting: hasExistingImage };
}
