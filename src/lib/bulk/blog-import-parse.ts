import { notify } from "@/lib/app-notifications";
import { notifyImportedXH2SectionsFromX } from "@/lib/notify-messages";
import type { CSVRow } from "@/lib/bulk-auto-generate";
import { parseImportedSectionsJson } from "@/lib/bulk/bulk-csv-parser";
import type { KeywordAIAnalysis, KeywordData } from "@/lib/keyword-types";
import {
  importedDraftToCsvRow,
  isBlogImportFileAccepted,
  parseBlogImportFile,
  type BlogImportFeaturedImage,
  type ImportedBlogDraft,
} from "@/lib/bulk/blog-import-parser";

export function rowHasImportedBlogSections(row: CSVRow): boolean {
  const sections = parseImportedSectionsJson(row.imported_sections_json);
  return sections != null && sections.length > 0;
}

export function buildBlogImportKeywordResearchStub(row: CSVRow): {
  keywordData: KeywordData;
  aiAnalysis: KeywordAIAnalysis;
  primaryKeyword: string;
} {
  const keyword = row.keyword?.trim() || row.title?.trim() || "blog";
  const keywordData: KeywordData = {
    keyword,
    difficulty: 0,
    searchVolume: 0,
    cpc: 0,
    competition: "LOW",
    intent: "informational",
    relatedKeywords: [],
    serpFeatures: [],
  };
  const aiAnalysis: KeywordAIAnalysis = {
    keywordSuggestions: { primary: keyword, variations: [], longTail: [], semantic: [] },
    h2Suggestions: [],
    contentGaps: [],
    peopleAlsoAsk: [],
    researchLinks: [],
  };
  return { keywordData, aiAnalysis, primaryKeyword: keyword };
}

export type BlogImportFormState = {
  focusKeyword: string;
  titleOverride: string;
  featuredImageMode: BlogImportFeaturedImage;
  entity: string;
};

export function buildBlogImportRowFromDraft(
  draft: ImportedBlogDraft,
  form: BlogImportFormState,
): CSVRow {
  return importedDraftToCsvRow(draft, form.focusKeyword.trim() || undefined, {
    featuredImage: form.featuredImageMode,
    entity: form.featuredImageMode === "google-maps" ? form.entity : undefined,
  });
}

export async function processBlogImportFile(
  file: File,
  form: BlogImportFormState,
): Promise<{ row: CSVRow; draft: ImportedBlogDraft; fileName: string }> {
  if (!isBlogImportFileAccepted(file)) {
    throw new Error("Use .docx, .md, .html, or .txt with ## or Heading 2 sections");
  }
  const draft = await parseBlogImportFile(file, {
    titleOverride: form.titleOverride.trim() || undefined,
  });
  const row = buildBlogImportRowFromDraft(draft, form);
  return { row, draft, fileName: file.name };
}

export async function pickAndParseBlogImportFile(
  file: File | null,
  form: BlogImportFormState,
  onSuccess: (row: CSVRow, draft: ImportedBlogDraft, fileName: string) => void,
  onClear: () => void,
): Promise<boolean> {
  if (!file) {
    return false;
  }
  try {
    const result = await processBlogImportFile(file, form);
    onSuccess(result.row, result.draft, result.fileName);
    notify.success(notifyImportedXH2SectionsFromX(result.draft.sections.length, result.fileName));
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to parse blog file";
    notify.error(errorMessage);
    onClear();
    return false;
  }
}
