import type { BulkHarnessSectionPayload } from "@/lib/bulk-auto-generate";

/** Mirrors bulk SAP/post harness UI rows (safe for lib ↔ hooks boundaries). */
export interface HarnessSectionListItem {
  sectionIndex: number;
  title: string;
  status: "waiting" | "generating" | "done";
  markdown?: string;
  truncated?: boolean;
}

/** Same rules as `useBulkAutoGenerate` harness callback — shared by optimizer + bulk sync. */
export function reduceHarnessSectionList(
  prev: HarnessSectionListItem[],
  payload: BulkHarnessSectionPayload,
): HarnessSectionListItem[] {
  const next = [...prev];
  const i = payload.sectionIndex;
  while (next.length <= i) {
    next.push({
      sectionIndex: next.length,
      title: "",
      status: "waiting",
    });
  }
  if (payload.phase === "start") {
    next[i] = {
      sectionIndex: i,
      title: payload.title,
      status: "generating",
      markdown: next[i]?.markdown,
      truncated: next[i]?.truncated,
    };
  } else if (payload.phase === "progress") {
    next[i] = {
      sectionIndex: i,
      title: payload.title || next[i]?.title || "",
      status: "generating",
      markdown: undefined,
      truncated: next[i]?.truncated,
    };
  } else {
    const markdown =
      payload.markdownSlice?.includes("=== WORD BLACKLIST") ||
      payload.markdownSlice?.includes("WORD BLACKLIST (READ ONLY")
        ? undefined
        : payload.markdownSlice;
    next[i] = {
      sectionIndex: i,
      title: payload.title,
      status: "done",
      markdown,
      truncated: payload.truncated,
    };
  }
  return next;
}
