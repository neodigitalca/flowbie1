import mammoth from "mammoth";
import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { parseJsonWithRepair } from "@/lib/json-repair-utility";
import { getResearchModel } from "@/lib/optimization-settings-storage";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import {
  importedDraftToCsvRow,
  inferKeywordFromTitle,
  parseImportedBlogHtml,
  type ImportedBlogDraft,
  type ImportedBlogSection,
} from "@/lib/bulk/blog-import-parser";
import type { BlogImportFormState } from "@/lib/bulk/blog-import-parse";
import {
  collectImportedDraftLinksFromSections,
  dedupeImportedDraftLinks,
  extractImportedDraftLinksFromHtml,
} from "@/lib/bulk/blog-import-draft-links";

export async function readBlogImportFileHtml(file: File): Promise<string | null> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "docx") {
    const ab = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer: ab });
    return result.value?.trim() ?? null;
  }
  if (ext === "html" || ext === "htm") {
    const html = await file.text();
    return html.trim() || null;
  }
  return null;
}

async function buildDraftFromImportFile(
  file: File,
  form: BlogImportFormState,
  openRouterSections: ImportedBlogSection[],
  openRouterTitle: string,
): Promise<ImportedBlogDraft> {
  const html = await readBlogImportFileHtml(file);
  const htmlDraft = html ? parseImportedBlogHtml(html, file.name, form.titleOverride.trim() || undefined) : null;
  const title =
    form.titleOverride.trim() ||
    openRouterTitle ||
    htmlDraft?.title ||
    file.name.replace(/\.[^.]+$/, "");

  const sections =
    htmlDraft?.sections.length ? htmlDraft.sections : openRouterSections;

  const docLinks = html ? extractImportedDraftLinksFromHtml(html) : [];
  const sectionLinks = collectImportedDraftLinksFromSections(sections);
  const links = dedupeImportedDraftLinks([...(htmlDraft?.links ?? []), ...docLinks, ...sectionLinks]);
  return {
    title,
    sections,
    ...(htmlDraft?.preambleHtml ? { preambleHtml: htmlDraft.preambleHtml } : {}),
    links: links.length ? links : undefined,
  };
}

export function buildBlogImportPlaceholderRow(
  fileName: string,
  form: BlogImportFormState,
): CSVRow {
  const base = fileName.replace(/\.[^.]+$/, "").trim() || "Imported blog post";
  const title = form.titleOverride.trim() || base;
  const keyword = form.focusKeyword.trim() || inferKeywordFromTitle(title);
  return {
    keyword,
    title,
    featuredImage: form.featuredImageMode,
    ...(form.featuredImageMode === "google-maps" && form.entity.trim()
      ? { entity: form.entity.trim() }
      : {}),
  };
}

export async function readBlogImportFileText(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "docx") {
    const ab = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: ab });
    return result.value?.trim() ?? "";
  }
  return file.text();
}

const EXTRACT_SYSTEM = `You structure blog drafts for an SEO rewrite pipeline. Read the full document and return JSON only.

Rules:
- Include EVERY heading in document order (title/H1 and every section H2). None may be omitted.
- Preserve heading text verbatim in sections[].h2.
- sections[].body: full section content as plain text (no truncation).
- Need at least 2 sections with non-empty h2.
- title: document title (first heading or H1).

Return JSON:
{"title":"string","sections":[{"h2":"string","body":"string"}]}`;

export async function resolveBlogImportRowViaOpenRouter(
  file: File,
  form: BlogImportFormState,
  openRouterApiKey: string,
  model?: string,
): Promise<CSVRow> {
  const rawText = await readBlogImportFileText(file);

  if (!rawText.trim()) {
    throw new Error("File is empty or could not be read as text");
  }

  const html = await readBlogImportFileHtml(file);
  let openRouterSections: ImportedBlogSection[] = [];
  let openRouterTitle = "";

  if (!html) {
    const { content } = await callOpenRouterChatCompletion({
      apiKey: openRouterApiKey,
      model: model || getResearchModel(),
      system: EXTRACT_SYSTEM,
      user: `File: ${file.name}\n\n${rawText.slice(0, 120_000)}`,
      maxTokens: 8000,
      temperature: 0.2,
      responseFormat: { type: "json_object" },
    });

    const { parsed } = parseJsonWithRepair<{
      title?: string;
      sections?: Array<{ h2?: string; body?: string }>;
    }>(content);

    openRouterSections = (parsed?.sections ?? [])
      .map((s) => ({
        h2: String(s.h2 ?? "").trim(),
        body: String(s.body ?? "").trim(),
      }))
      .filter((s) => s.h2);
    openRouterTitle = String(parsed.title ?? "").trim();
  }

  const draft = await buildDraftFromImportFile(
    file,
    form,
    openRouterSections,
    openRouterTitle,
  );

  if (draft.sections.length < 2) {
    throw new Error(
      `Found ${draft.sections.length} heading(s). Need at least 2 headings in the document.`,
    );
  }

  return importedDraftToCsvRow(draft, form.focusKeyword.trim() || undefined, {
    featuredImage: form.featuredImageMode,
    entity: form.featuredImageMode === "google-maps" ? form.entity : undefined,
  });
}
