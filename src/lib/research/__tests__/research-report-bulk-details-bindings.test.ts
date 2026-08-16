import { describe, expect, it } from "vitest";
import { buildBacklinkingBulkGeneratorDetailsProps } from "@/lib/research/backlinking-bulk-details-bindings";
import { buildCitationBulkGeneratorDetailsProps } from "@/lib/research/citation-bulk-details-bindings";
import { buildProposalBulkGeneratorDetailsProps } from "@/lib/research/proposal-bulk-details-bindings";
import { buildGscReportingBulkGeneratorDetailsProps } from "@/lib/gsc-reporting/gsc-reporting-bulk-details-bindings";

describe("buildGscReportingBulkGeneratorDetailsProps", () => {
  it("maps outline sections to per-row harness without global batch summary", () => {
    const props = buildGscReportingBulkGeneratorDetailsProps({
      busy: true,
      progress: { step: 1, total: 3, label: "Writing section" },
      siteName: "Example",
      siteUrl: "https://example.com",
      gscFetchPreset: "mom",
      gscFetchRange: null,
      gscCompareFetchRange: null,
      cachedFileCount: 2,
      sectionCount: 2,
      outlineSections: [
        { id: "s1", h2Title: "Executive summary", kind: "executive_summary", ragQuery: "summary" },
        { id: "s2", h2Title: "Performance", kind: "search_performance_period", ragQuery: "performance" },
      ],
      generatingSectionIndex: 1,
    });

    expect(props.displayRows).toHaveLength(2);
    expect(props.harnessSections).toEqual([]);
    expect(props.harnessByRow?.get(1)?.[0]?.status).toBe("generating");
    expect(props.currentRow).toBe(1);
  });
});

describe("buildProposalBulkGeneratorDetailsProps", () => {
  it("uses single pseudo-row pipeline harness", () => {
    const props = buildProposalBulkGeneratorDetailsProps({
      busy: true,
      workspaceMode: "connected",
      phase: "report",
      proposalSubphase: "competitor",
      competitorPipelineStep: 3,
      competitorPipelineLabel: "Strategist",
      localPipelineStep: 0,
      localPipelineLabel: null,
      reportMicroLabel: null,
      gscError: null,
      gridSapSummaryMarkdown: "",
      gridCsvBusy: false,
      gridCsvProgress: null,
      error: null,
      hasSapScheduleRows: false,
      onDownloadEntitySapCsv: () => {},
    });

    expect(props.harnessSections).toEqual([]);
    expect(props.harnessByRow?.get(0)?.length).toBeGreaterThan(0);
  });
});

describe("buildCitationBulkGeneratorDetailsProps", () => {
  it("maps citation run to harnessByRow", () => {
    const props = buildCitationBulkGeneratorDetailsProps({
      busy: true,
      workspaceMode: "connected",
      siteUrl: "https://example.com",
      seedKeyword: "plumber",
      hasRecord: false,
    });

    expect(props.harnessByRow?.get(0)?.[0]?.status).toBe("generating");
    expect(props.harnessSections).toEqual([]);
  });
});

describe("buildBacklinkingBulkGeneratorDetailsProps", () => {
  it("maps tile results to done harness", () => {
    const props = buildBacklinkingBulkGeneratorDetailsProps({
      busy: false,
      loadingHint: null,
      lastKeyword: "widgets",
      industry: "Retail",
      locationName: "Edmonton",
      gmbChoiceCount: 2,
      tileCount: 4,
    });

    expect(props.harnessByRow?.get(0)?.[0]?.status).toBe("done");
    expect(props.harnessSections).toEqual([]);
  });
});
