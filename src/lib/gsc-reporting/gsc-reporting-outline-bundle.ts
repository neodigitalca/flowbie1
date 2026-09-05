/**
 * Smaller CSV bundle for the GSC outline LLM step (executiveSummary + topOpportunities only).
 * Full files stay in the pipeline for per-section RAG; outline does not need indexed URL inventories.
 */
import { bundleGscManualFilesForPrompt } from "@/lib/gsc-manual-ai-aggregate";

/** Outline reads site totals, compare signals, sitemap names, and top query/page rows only. */
const OUTLINE_ALWAYS_FILES = new Set([
  "Site-totals-MoM.csv",
  "Site-totals-compare-signals.txt",
  "GSC-sitemaps.csv",
]);

const OUTLINE_CAPPED_CSV_FILES = new Set([
  "Queries-MoM.csv",
  "Pages-MoM.csv",
  "Queries-YoY.csv",
  "Pages-YoY.csv",
]);

/** Max data rows (after header) kept from large MoM/YoY CSVs for outline synthesis. */
const OUTLINE_MAX_CSV_DATA_ROWS = 120;

/** Hard cap on bundled outline prompt size (well below manual aggregate cap). */
export const GSC_OUTLINE_MAX_INPUT_CHARS = 96_000;

function capCsvContent(name: string, content: string, maxDataRows: number): string {
  const lines = content.split(/\r?\n/);
  if (lines.length <= maxDataRows + 1) return content;
  const header = lines[0] ?? "";
  const kept = lines.slice(1, maxDataRows + 1);
  const omitted = lines.length - 1 - maxDataRows;
  return [
    header,
    ...kept,
    `[…${name}: ${omitted} additional rows omitted from outline prompt; section steps use full CSV…]`,
  ].join("\n");
}

export function selectGscOutlineSourceFiles(
  files: { name: string; content: string }[],
): { name: string; content: string }[] {
  const out: { name: string; content: string }[] = [];
  for (const file of files) {
    const name = file.name.trim();
    if (!name || !file.content.trim()) continue;
    if (OUTLINE_ALWAYS_FILES.has(name)) {
      out.push(file);
      continue;
    }
    if (OUTLINE_CAPPED_CSV_FILES.has(name)) {
      out.push({ name, content: capCsvContent(name, file.content, OUTLINE_MAX_CSV_DATA_ROWS) });
      continue;
    }
    if (name.startsWith("Indexed-pages-urls")) continue;
    if (name.includes("GenerativeAI")) out.push(file);
  }
  return out.length > 0 ? out : files.filter((f) => f.content.trim());
}

export function bundleGscOutlineFilesForPrompt(files: { name: string; content: string }[]): {
  text: string;
  truncated: boolean;
  filenames: string[];
} {
  const selected = selectGscOutlineSourceFiles(files);
  const bundled = bundleGscManualFilesForPrompt(selected);
  if (bundled.text.length <= GSC_OUTLINE_MAX_INPUT_CHARS) {
    return bundled;
  }
  const ratio = GSC_OUTLINE_MAX_INPUT_CHARS / bundled.text.length;
  const tighter = selected.map((file) => {
    const cap = Math.max(400, Math.floor(file.content.length * ratio));
    if (file.content.length <= cap) return file;
    return {
      name: file.name,
      content: `${file.content.slice(0, cap)}\n[…${file.name}: outline prompt cap; section steps use full CSV…]`,
    };
  });
  const tighterBundled = bundleGscManualFilesForPrompt(tighter);
  if (tighterBundled.text.length <= GSC_OUTLINE_MAX_INPUT_CHARS) {
    return tighterBundled;
  }
  return {
    text: tighterBundled.text.slice(0, GSC_OUTLINE_MAX_INPUT_CHARS),
    truncated: true,
    filenames: tighterBundled.filenames,
  };
}
