import { describe, expect, it } from "vitest";
import {
  buildOverviewBulkGeneratorDetailsProps,
  buildOverviewMicroActionDetailsProps,
  isOverviewBulkDetailsRun,
  resolveOverviewBulkPipelineTitles,
} from "@/lib/overview/overview-bulk-details-bindings";
import type { BulkOptimizationState } from "@/hooks/content-optimization/use-optimization-state";
import type { OverviewRow } from "@/components/overview/overview-meta-row-types";
import { RESEARCH_HARNESS_SECTION_TITLES } from "@/lib/overview/overview-research-harness-sections";
import { HEADERS_HARNESS_SECTION_TITLES } from "@/lib/overview/overview-blog-headers-harness-sections";
import { overviewBulkScopeUrlKeysFromRows } from "@/lib/overview/overview-bulk-row-scope";
import { initBulkSliceBatchHarness } from "@/lib/overview/overview-batch-pipeline-progress";

const baseBulkState = (): BulkOptimizationState => ({
  urls: ["https://example.com/a"],
  currentIndex: 0,
  urlStatuses: { "https://example.com/a": "optimizing" },
  currentStep: "Headers",
  runKind: "aiHeaders",
});

function makeOverviewRow(url: string, status: OverviewRow["status"] = "idle"): OverviewRow {
  return {
    url,
    title: `Title for ${url}`,
    metaDescription: "",
    aiTitle: "",
    aiMeta: "",
    status,
  };
}

describe("isOverviewBulkDetailsRun", () => {
  it("returns true for any batch with urls", () => {
    expect(isOverviewBulkDetailsRun(baseBulkState())).toBe(true);
  });

  it("returns false without urls", () => {
    expect(isOverviewBulkDetailsRun({ ...baseBulkState(), urls: [] })).toBe(false);
  });
});

describe("resolveOverviewBulkPipelineTitles", () => {
  it("maps research run kind", () => {
    expect(resolveOverviewBulkPipelineTitles("research")).toEqual([
      ...RESEARCH_HARNESS_SECTION_TITLES,
    ]);
  });

  it("maps headers run kind", () => {
    expect(resolveOverviewBulkPipelineTitles("aiHeaders")).toEqual([
      ...HEADERS_HARNESS_SECTION_TITLES,
    ]);
  });

  it("returns undefined for dynamic aiAllMeta rows", () => {
    expect(resolveOverviewBulkPipelineTitles("aiAllMeta")).toBeUndefined();
  });
});

describe("buildOverviewBulkGeneratorDetailsProps", () => {
  it("includes sitemap inventory props", () => {
    const props = buildOverviewBulkGeneratorDetailsProps(
      {
        siteId: "site-1",
        batchKey: "site-1-batch",
        bulkState: baseBulkState(),
        overviewRows: [],
        isOptimizingContent: { "site-1-batch": true },
        optimizationFileManagers: {},
        sitemapInventoryLinks: [
          { label: "Pages", href: "blob:1", filename: "pages.json", rowCount: 1, source: "pages" },
        ],
        siteKwHostedLink: null,
        sitemapInventoryLoading: false,
        sitemapSource: "sap",
      },
      true,
    );
    expect(props?.sitemapInventoryLinks).toHaveLength(1);
    expect(props?.entitySapRowDisplay).toBe(true);
    expect(props?.pipelineSectionTitles).toEqual([...HEADERS_HARNESS_SECTION_TITLES]);
    expect(props?.batchPrepHarnessSections).toEqual([]);
  });
});

describe("buildOverviewMicroActionDetailsProps", () => {
  it("builds per-row harness for aiMeta on scoped rows", () => {
    const overviewRows = Array.from({ length: 85 }, (_, i) =>
      makeOverviewRow(`https://example.com/page-${i}`, i === 3 ? "ai-meta" : "idle"),
    );
    const scopeKeys = overviewBulkScopeUrlKeysFromRows(overviewRows);
    const slice = initBulkSliceBatchHarness(
      { total: 85, completed: 12 },
      85,
      "AI meta",
    );

    const props = buildOverviewMicroActionDetailsProps(
      {
        siteId: "site-1",
        batchKey: "site-1-batch",
        overviewRows,
        isOptimizingContent: {},
        optimizationFileManagers: {},
        bulkScopeUrlKeys: scopeKeys,
        sitemapSource: "pages",
      },
      "aiMeta",
      slice,
    );

    expect(props.displayRows).toHaveLength(85);
    expect(props.harnessByRow?.size).toBe(85);
    expect(props.harnessSections).toEqual([]);
    expect(props.pipelineSectionTitles).toEqual(["AI meta"]);

    const generatingRow = props.harnessByRow?.get(3)?.[0];
    expect(generatingRow?.title).toBe("AI meta");
    expect(generatingRow?.status).toBe("generating");

    const waitingRow = props.harnessByRow?.get(0)?.[0];
    expect(waitingRow?.status).toBe("waiting");

    expect(props.currentRow).toBe(3);
  });

  it("does not put batch summary labels in drawer harnessSections", () => {
    const overviewRows = [makeOverviewRow("https://example.com/a", "ai-title")];
    const scopeKeys = overviewBulkScopeUrlKeysFromRows(overviewRows);
    const slice = initBulkSliceBatchHarness({ total: 1, completed: 0 }, 1, "AI titles");

    const props = buildOverviewMicroActionDetailsProps(
      {
        siteId: "site-1",
        batchKey: "site-1-batch",
        overviewRows,
        isOptimizingContent: {},
        optimizationFileManagers: {},
        bulkScopeUrlKeys: scopeKeys,
      },
      "aiTitle",
      slice,
    );

    expect(props.harnessSections).toEqual([]);
    expect(props.pipelineSectionTitles).toEqual(["AI titles"]);
    expect(slice.pipelineSteps?.[0]?.label).toContain("rows");
    expect(props.harnessByRow?.get(0)?.[0]?.title).toBe("AI titles");
  });

  it("routes active micro slice through buildOverviewBulkGeneratorDetailsProps", () => {
    const overviewRows = [makeOverviewRow("https://example.com/a", "ai-meta")];
    const scopeKeys = overviewBulkScopeUrlKeysFromRows(overviewRows);

    const props = buildOverviewBulkGeneratorDetailsProps(
      {
        siteId: "site-1",
        batchKey: "site-1-batch",
        bulkState: { urls: [], currentIndex: 0, urlStatuses: {}, currentStep: "" },
        overviewRows,
        isOptimizingContent: {},
        optimizationFileManagers: {},
        bulkScopeUrlKeys: scopeKeys,
        bulkActionProgress: {
          aiMeta: { total: 1, completed: 0 },
        },
      },
      true,
    );

    expect(props?.displayRows).toHaveLength(1);
    expect(props?.harnessByRow?.size).toBe(1);
    expect(props?.harnessSections).toEqual([]);
  });
});
