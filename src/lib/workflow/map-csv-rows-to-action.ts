import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import type { TaskExecutionKind, TaskExecutionPayload } from "@/lib/tasks-types";
import {
  csvRowsKindConsumesRows,
  csvRowsKindIsSequential,
  encodeCsvUtf8ToBase64,
  type CsvRowsColumnMap,
} from "@/lib/workflow/csv-rows-types";
import {
  pickCsvMappedCell,
  splitCsvQuestionsCell,
  type WorkflowCsvRecord,
} from "@/lib/workflow/parse-workflow-csv-rows";
import { formatUpstreamResearchFactsUserBlock } from "@/lib/workflow/upstream-research-facts";

export type CsvRowsActionMapping = {
  mode: "bulk" | "sequential";
  payload: TaskExecutionPayload;
  sequentialPayloads?: TaskExecutionPayload[];
};

function keywordFromUrl(url: string): string {
  try {
    const slug = new URL(url).pathname.split("/").filter(Boolean).pop() ?? "";
    return slug.split("-").join(" ").trim();
  } catch {
    return "";
  }
}

function requireUrl(record: WorkflowCsvRecord, columnMap: CsvRowsColumnMap, rowIndex: number): string {
  const url = pickCsvMappedCell(record, columnMap, "url");
  if (!url) {
    throw new Error(`CSV row ${rowIndex + 1} is missing a URL.`);
  }
  return url;
}

function mergeResearch(existing: string | undefined, next: string): string {
  const a = (existing ?? "").trim();
  const b = next.trim();
  if (!a) return b;
  if (!b || a === b) return a;
  return `${a}\n\n${b}`;
}

function mapOptimizer(
  records: WorkflowCsvRecord[],
  columnMap: CsvRowsColumnMap,
): TaskExecutionPayload {
  const prefilledUrlResearch: Record<string, string> = {};
  const urls: string[] = [];
  for (let i = 0; i < records.length; i += 1) {
    const url = requireUrl(records[i]!, columnMap, i);
    if (!prefilledUrlResearch[url]) urls.push(url);
    const research = pickCsvMappedCell(records[i]!, columnMap, "research");
    if (research) {
      prefilledUrlResearch[url] = mergeResearch(prefilledUrlResearch[url], research);
    }
  }
  return {
    targetUrls: urls,
    prefilledUrlResearch,
  };
}

function mapPostCreator(
  records: WorkflowCsvRecord[],
  columnMap: CsvRowsColumnMap,
  useUpstreamContext: boolean,
): TaskExecutionPayload {
  const rows: CSVRow[] = records.map((record, index) => {
    const url = pickCsvMappedCell(record, columnMap, "url");
    const keyword =
      pickCsvMappedCell(record, columnMap, "keyword") || keywordFromUrl(url);
    const title = pickCsvMappedCell(record, columnMap, "title") || keyword;
    if (!keyword) {
      throw new Error(`CSV row ${index + 1} is missing a keyword and URL.`);
    }
    const research = pickCsvMappedCell(record, columnMap, "research");
    const row: CSVRow = {
      keyword,
      title: title || keyword,
      destination_url: url || undefined,
      seo_research: useUpstreamContext && research ? research : undefined,
      prompt_modifier:
        useUpstreamContext && research
          ? formatUpstreamResearchFactsUserBlock(research)
          : undefined,
    };
    return row;
  });
  return {
    keywordSource: "manual",
    prefilledImportRows: rows,
    postCount: rows.length,
    useUpstreamContext,
  };
}

function mapDfsRow(
  record: WorkflowCsvRecord,
  columnMap: CsvRowsColumnMap,
  rowIndex: number,
  extractedQuestions?: string[],
): TaskExecutionPayload {
  const url = requireUrl(record, columnMap, rowIndex);
  const fromColumn = splitCsvQuestionsCell(pickCsvMappedCell(record, columnMap, "questions"));
  const questions = fromColumn.length > 0 ? fromColumn : extractedQuestions ?? [];
  if (questions.length === 0) {
    throw new Error(`CSV row ${rowIndex + 1} has no proposed questions for DFS LLM article audit.`);
  }
  const keyword = pickCsvMappedCell(record, columnMap, "keyword") || keywordFromUrl(url);
  if (!keyword) {
    throw new Error(`CSV row ${rowIndex + 1} is missing a focus keyword for DFS LLM article audit.`);
  }
  return {
    targetUrl: url,
    targetBucket: "posts",
    auditQuestions: questions,
    focusKeyword: keyword,
    keyword,
    seoResearchBrief: pickCsvMappedCell(record, columnMap, "research") || undefined,
  };
}

function mapBrowserRow(
  record: WorkflowCsvRecord,
  columnMap: CsvRowsColumnMap,
  rowIndex: number,
): TaskExecutionPayload {
  const url = requireUrl(record, columnMap, rowIndex);
  return { targetUrl: url, targetUrlSource: "manual" };
}

function mapEntityCsv(csvText: string): TaskExecutionPayload {
  return {
    entityCsvInputSource: "upload",
    entityCsvBase64: encodeCsvUtf8ToBase64(csvText),
    entityCsvUrl: undefined,
  };
}

export function mapCsvRecordsToAction(input: {
  kind: TaskExecutionKind | string;
  records: WorkflowCsvRecord[];
  columnMap: CsvRowsColumnMap;
  csvText?: string;
  useUpstreamContext?: boolean;
  extractedQuestionsByRow?: Record<number, string[]>;
}): CsvRowsActionMapping {
  const kind = String(input.kind ?? "").trim() as TaskExecutionKind;
  if (!csvRowsKindConsumesRows(kind)) {
    throw new Error(
      `CSV rows cannot run ${kind || "this step"}. Use optimizer, post creator, DFS LLM article audit, entity/SAP, or browser automation.`,
    );
  }
  if (input.records.length === 0) {
    throw new Error("CSV has no data rows.");
  }

  if (kind === "content_optimizer" || kind === "content_optimizer_meta") {
    return { mode: "bulk", payload: mapOptimizer(input.records, input.columnMap) };
  }
  if (kind === "post_creator") {
    return {
      mode: "bulk",
      payload: mapPostCreator(input.records, input.columnMap, input.useUpstreamContext === true),
    };
  }
  if (kind === "entity_page_creator" || kind === "entity_generator" || kind === "sap_generator") {
    if (!input.csvText?.trim()) {
      throw new Error("CSV text is required for entity and SAP steps.");
    }
    const payload = mapEntityCsv(input.csvText);
    if (kind === "entity_page_creator") {
      payload.gridInputSource = "upload";
      payload.gridCsvBase64 = payload.entityCsvBase64;
      payload.locationSource = "grid";
    }
    return { mode: "bulk", payload };
  }

  if (!csvRowsKindIsSequential(kind)) {
    throw new Error(`CSV rows cannot run ${kind}.`);
  }

  const sequentialPayloads = input.records.map((record, index) => {
    if (kind === "dfs_llm_article_audit") {
      return mapDfsRow(
        record,
        input.columnMap,
        index,
        input.extractedQuestionsByRow?.[index],
      );
    }
    return mapBrowserRow(record, input.columnMap, index);
  });
  return {
    mode: "sequential",
    payload: sequentialPayloads[0]!,
    sequentialPayloads,
  };
}

export function dfsRowNeedsQuestionExtract(
  record: WorkflowCsvRecord,
  columnMap: CsvRowsColumnMap,
): boolean {
  const fromColumn = splitCsvQuestionsCell(pickCsvMappedCell(record, columnMap, "questions"));
  if (fromColumn.length > 0) return false;
  return Boolean(pickCsvMappedCell(record, columnMap, "research"));
}
