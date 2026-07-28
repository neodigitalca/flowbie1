import type { BlogHeadersPlanResult } from "@/lib/overview/overview-blog-headers-agent";

export function headerTextEqual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Drop optimize actions where NEW equals existing H2 text. */
export function filterNoOpBlogHeadersPlan(
  plan: BlogHeadersPlanResult,
  existingH2s: string[],
): BlogHeadersPlanResult {
  return {
    h2Actions: plan.h2Actions.filter((a) => {
      const now = a.proposedText.trim();
      if (!now || a.action !== "optimize") return false;
      const was = (existingH2s[a.index] ?? "").trim();
      return !headerTextEqual(was, now);
    }),
  };
}
