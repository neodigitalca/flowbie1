import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import {
  permalinkParentPrefixFromPageUrl,
  suggestedPathFromFocusKeywordForMetaOptimizer,
} from "@/lib/seo-redirect-csv";
import {
  buildOverviewRedirectRow,
  type OverviewRedirectRow,
} from "@/lib/overview/overview-redirect-row";

export type OverviewAiUrlSuggestion =
  | { ok: false; reason: "bad-url" }
  | {
      ok: true;
      patch: Partial<OverviewRow>;
      redirect: OverviewRedirectRow | null;
    };

export function computeOverviewAiUrlSuggestion(row: OverviewRow): OverviewAiUrlSuggestion {
  let pathname = "/";
  try {
    pathname = new URL(row.url).pathname || "/";
  } catch {
    return { ok: false, reason: "bad-url" };
  }

  const outcome = suggestedPathFromFocusKeywordForMetaOptimizer(pathname, row.focusKeyword);
  if (outcome.kind === "noop") {
    return { ok: true, patch: { status: "idle" }, redirect: null };
  }
  if (outcome.kind === "clear") {
    return { ok: true, patch: { aiSuggestedPath: "", status: "idle" }, redirect: null };
  }

  const parent = permalinkParentPrefixFromPageUrl(row.url);
  const relativePath = parent ? `${parent}${outcome.path}` : outcome.path;
  const redirect = buildOverviewRedirectRow({
    ...row,
    aiSuggestedPath: relativePath,
  });

  return {
    ok: true,
    patch: { aiSuggestedPath: relativePath, status: "idle" },
    redirect,
  };
}
