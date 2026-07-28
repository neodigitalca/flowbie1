import type { FlowFreeformClarifyQuestion } from "@/lib/flow-freeform/flow-freeform-types";

/** Separator between selected option and optional custom text (stored in clarificationAnswers[q.id]). */
export const CLARIFY_MERGE_SEP = " - ";

export function mergeClarifiedAnswer(radio: string, custom: string): string {
  const c = custom.trim();
  const r = radio.trim();
  if (c && r) return `${r}${CLARIFY_MERGE_SEP}${c}`;
  if (c) return c;
  if (r) return r;
  return "";
}

export function parseStoredClarification(
  q: FlowFreeformClarifyQuestion,
  merged: string,
): { radio: string; custom: string } {
  const m = merged.trim();
  if (!m) return { radio: "", custom: "" };
  if (q.options.includes(m)) return { radio: m, custom: "" };
  const idx = m.indexOf(CLARIFY_MERGE_SEP);
  if (idx !== -1) {
    const head = m.slice(0, idx).trim();
    const tail = m.slice(idx + CLARIFY_MERGE_SEP.length).trim();
    if (q.options.includes(head)) return { radio: head, custom: tail };
  }
  return { radio: "", custom: m };
}

export function triggerBlobDownload(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
