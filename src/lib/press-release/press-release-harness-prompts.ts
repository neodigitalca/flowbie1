import type { BulkHarnessOutlineSection } from "@/lib/bulk/bulk-harness-outline";

/** Outline for harness context only — no pre-baked ## titles for the model to copy. */
export function formatPressReleaseOutlineForHarnessPrompt(
  outline: BulkHarnessOutlineSection[],
): string {
  return outline
    .map((o, i) => {
      const intent = o.description.trim();
      const oneLine = intent.length > 280 ? `${intent.slice(0, 280)}…` : intent;
      return `${i + 1}. Invent a topic-specific ## subhead for this block: ${oneLine}`;
    })
    .join("\n");
}

export function pressReleaseHarnessSectionLabel(sectionIndex: number): string {
  return `Section ${sectionIndex + 1}`;
}
