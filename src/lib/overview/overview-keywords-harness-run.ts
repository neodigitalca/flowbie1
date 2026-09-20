import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import type { OverviewSitemapSource } from "@/lib/overview/overview-sitemap-source";

export type KeywordHarnessMode = "content" | "entity";

export function keywordHarnessModeForSource(source: OverviewSitemapSource): KeywordHarnessMode {
  return source === "sap" ? "entity" : "content";
}

export function isOverviewKeywordRunKind(
  runKind: string | undefined,
): runKind is "contentKw" | "entityKw" {
  return runKind === "contentKw" || runKind === "entityKw";
}

export type WriteOverviewKeywordsOneAtATimeParams = {
  indices: number[];
  rowsRef: { current: OverviewRow[] };
  deriveKeyword: (index: number, row: OverviewRow) => Promise<string | null>;
  updateRow: (index: number, patch: Partial<OverviewRow>) => void;
  onRowDone?: (done: number, total: number) => void;
};

export async function writeOverviewKeywordsOneAtATime(
  params: WriteOverviewKeywordsOneAtATimeParams,
): Promise<{ ok: number; failed: number }> {
  const { indices, rowsRef, deriveKeyword, updateRow, onRowDone } = params;
  const total = indices.length;
  let ok = 0;
  let failed = 0;
  let done = 0;

  for (const index of indices) {
    const row = rowsRef.current[index];
    if (!row?.url?.trim()) {
      failed += 1;
      done += 1;
      onRowDone?.(done, total);
      continue;
    }
    updateRow(index, { status: "ai-focus-kw" });
    try {
      const keyword = (await deriveKeyword(index, row))?.trim() ?? "";
      if (!keyword) {
        updateRow(index, { status: "error" });
        failed += 1;
      } else {
        updateRow(index, { focusKeyword: keyword, status: "idle" });
        ok += 1;
      }
    } catch {
      updateRow(index, { status: "error" });
      failed += 1;
    }
    done += 1;
    onRowDone?.(done, total);
  }

  return { ok, failed };
}
