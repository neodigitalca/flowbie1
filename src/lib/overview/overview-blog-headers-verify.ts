import {
  extractH2TextsFromHtml,
  stripH2BlocksForCompare,
} from "@/lib/overview/overview-blog-headers-extract";
import type { BlogHeadersApplyResult, BlogHeadersPlanResult } from "@/lib/overview/overview-blog-headers-agent";

export type BlogHeadersVerifyResult =
  | { ok: true; finalH2s: string[]; updatedHtml: string }
  | { ok: false; reason: string };

export function verifyBlogHeadersApply(
  originalHtml: string,
  apply: BlogHeadersApplyResult,
  plan: BlogHeadersPlanResult,
): BlogHeadersVerifyResult {
  const updated = apply.updatedHtml.trim();
  if (!updated) {
    return { ok: false, reason: "Empty updatedHtml from agent" };
  }

  const strippedOrig = stripH2BlocksForCompare(originalHtml);
  const strippedNew = stripH2BlocksForCompare(updated);
  if (strippedOrig !== strippedNew) {
    return { ok: false, reason: "Non-H2 body markup changed" };
  }

  const finalH2s =
    apply.finalH2s.length > 0 ? apply.finalH2s : extractH2TextsFromHtml(updated);
  const hadAdds = plan.h2Actions.some((a) => a.action === "add");
  if (hadAdds && finalH2s.length === 0) {
    return { ok: false, reason: "Plan required adds but no H2s in result" };
  }

  return { ok: true, finalH2s, updatedHtml: updated };
}
