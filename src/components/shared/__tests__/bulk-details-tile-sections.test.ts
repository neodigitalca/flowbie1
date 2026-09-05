import { describe, expect, it } from "vitest";
import {
  isSerpBriefGeneratedFileName,
  isHarnessSectionDownloadReady,
  resolveDetailsPipelineSections,
  resolvePipelineSectionDownloadable,
  resolveSerpBriefDownloadable,
} from "@/components/shared/bulk-details-tile-sections";
import { RESEARCH_HARNESS_SECTION_TITLES } from "@/lib/overview/overview-research-harness-sections";

describe("isSerpBriefGeneratedFileName", () => {
  it("matches SERP brief artifacts and not keyword-research", () => {
    expect(isSerpBriefGeneratedFileName("serp-research-brief-solar.json")).toBe(true);
    expect(isSerpBriefGeneratedFileName("seo-research-solar-1.json")).toBe(true);
    expect(isSerpBriefGeneratedFileName("acf-seo-research-solar.json")).toBe(true);
    expect(isSerpBriefGeneratedFileName("keyword-research-solar.json")).toBe(false);
    expect(isSerpBriefGeneratedFileName("blueprint-solar.json")).toBe(false);
  });
});

describe("resolvePipelineSectionDownloadable", () => {
  const serpSection = { sectionIndex: 0, title: "SERP research brief", status: "done" as const };
  const blueprintSection = { sectionIndex: 2, title: "Blueprint", status: "done" as const };

  it("attaches the SERP brief in strict mode even when harness step is waiting", () => {
    const claimed = new Set<string>();
    const brief = {
      name: "serp-research-brief-solar.json",
      content: '{"version":1,"focusKeyword":"solar"}',
      mimeType: "application/json",
    };
    const waitingSerp = { sectionIndex: 0, title: "SERP research brief", status: "waiting" as const };
    const out = resolvePipelineSectionDownloadable(
      waitingSerp,
      0,
      [],
      claimed,
      brief,
      { noFallback: true },
    );
    expect(out?.name).toBe("serp-research-brief-solar.json");
  });

  it("builds SERP brief download from overview grid seoResearch before run files exist", () => {
    const brief = resolveSerpBriefDownloadable(
      "Solar Panel Efficiency",
      [],
      '{"version":1,"focusKeyword":"Solar Panel Efficiency"}',
    );
    expect(brief?.name).toContain("serp-research-brief");
    expect(brief?.content).toContain("Solar Panel Efficiency");
  });

  it("links blueprint files in strict mode and skips dummy fallback", () => {
    const claimed = new Set<string>();
    const blueprint = {
      name: "blueprint-solar-1.json",
      content: "{}",
      mimeType: "application/json",
    };
    const linked = resolvePipelineSectionDownloadable(
      blueprintSection,
      1,
      [blueprint],
      claimed,
      null,
      { noFallback: true },
    );
    expect(linked?.name).toBe("blueprint-solar-1.json");
  });

  it("returns no download for empty SERP steps in strict optimize mode", () => {
    const empty = resolvePipelineSectionDownloadable(
      serpSection,
      0,
      [],
      new Set(),
      null,
      { noFallback: true },
    );
    expect(empty).toBeNull();
  });
});

describe("isHarnessSectionDownloadReady", () => {
  it("blocks waiting and generating; allows done only", () => {
    expect(isHarnessSectionDownloadReady({ sectionIndex: 0, title: "A", status: "waiting" })).toBe(false);
    expect(isHarnessSectionDownloadReady({ sectionIndex: 0, title: "A", status: "done" })).toBe(true);
    expect(
      isHarnessSectionDownloadReady({
        sectionIndex: 0,
        title: "A",
        status: "generating",
        markdown: "# draft",
      }),
    ).toBe(false);
    expect(
      isHarnessSectionDownloadReady({ sectionIndex: 0, title: "A", status: "generating" }),
    ).toBe(false);
  });
});

describe("resolveDetailsPipelineSections", () => {
  it("reserves every research pipeline title up front to prevent CLS", () => {
    const sections = resolveDetailsPipelineSections(
      [{ sectionIndex: 0, title: "DataForSEO SERP", status: "generating" }],
      undefined,
      RESEARCH_HARNESS_SECTION_TITLES,
    );
    expect(sections).toHaveLength(8);
    expect(sections.map((section) => section.title)).toEqual([...RESEARCH_HARNESS_SECTION_TITLES]);
    expect(sections.filter((section) => section.status === "waiting")).toHaveLength(7);
    expect(sections.find((section) => section.title === "DataForSEO SERP")?.status).toBe("generating");
  });

  it("fills all 8 research titles from empty persisted harness", () => {
    const sections = resolveDetailsPipelineSections(undefined, undefined, RESEARCH_HARNESS_SECTION_TITLES);
    expect(sections).toHaveLength(8);
    expect(sections.every((section) => section.status === "waiting")).toBe(true);
  });

  it("links keyword research JSON to early pipeline rows", () => {
    const claimed = new Set<string>();
    const keywordFile = {
      name: "keyword-research-smart-blinds-1788537869794.json",
      content: "{}",
      mimeType: "application/json",
    };
    const selectedFile = {
      name: "selected-keyword-smart-blinds-1788537869792.json",
      content: "{}",
      mimeType: "application/json",
    };
    const keywordSection = { sectionIndex: 0, title: "Keyword research", status: "waiting" as const };
    const selectedSection = { sectionIndex: 1, title: "Selected keyword", status: "waiting" as const };
    expect(
      resolvePipelineSectionDownloadable(
        keywordSection,
        0,
        [keywordFile, selectedFile],
        claimed,
        null,
        { noFallback: true },
      )?.name,
    ).toBe(keywordFile.name);
    expect(
      resolvePipelineSectionDownloadable(
        selectedSection,
        1,
        [keywordFile, selectedFile],
        claimed,
        null,
        { noFallback: true },
      )?.name,
    ).toBe(selectedFile.name);
  });

  it("marks Play content steps done from generated files", () => {
    const sections = resolveDetailsPipelineSections(
      undefined,
      undefined,
      [
        "SERP research brief",
        "Checklist",
        "Blueprint",
        "Content HTML",
        "Content Markdown",
      ],
      [
        { name: "serp-research-brief-hunter-douglas.json" },
        { name: "checklist-hunter-douglas.json" },
        { name: "blueprint-hunter-douglas.json" },
      ],
    );
    expect(sections).toHaveLength(5);
    expect(sections.map((section) => section.title)).toEqual([
      "SERP research brief",
      "Checklist",
      "Blueprint",
      "Content HTML",
      "Content Markdown",
    ]);
    expect(sections.filter((section) => section.status === "waiting")).toHaveLength(5);
  });

  it("does not auto-mark content optimize steps done from files alone", () => {
    const sections = resolveDetailsPipelineSections(
      undefined,
      undefined,
      ["Keyword research", "Blueprint"],
      [{ name: "keyword-research-x.json" }, { name: "blueprint-x.json" }],
    );
    expect(sections.every((section) => section.status === "waiting")).toBe(true);
  });
});

describe("content optimize download gating", () => {
  it("blocks file link until harness status is done when no artifact exists", () => {
    const waiting = { sectionIndex: 0, title: "Keyword research", status: "waiting" as const };
    expect(
      resolvePipelineSectionDownloadable(waiting, 0, [], new Set(), null, {
        noFallback: true,
        requireDoneStatus: true,
      }),
    ).toBeNull();
    const file = {
      name: "keyword-research-smart-blinds.json",
      content: "{}",
      mimeType: "application/json",
    };
    const done = { ...waiting, status: "done" as const };
    expect(
      resolvePipelineSectionDownloadable(done, 0, [file], new Set(), null, {
        noFallback: true,
        requireDoneStatus: true,
      })?.name,
    ).toBe(file.name);
  });

  it("allows download when artifact exists even if harness is still waiting", () => {
    const file = {
      name: "keyword-research-smart-blinds.json",
      content: "{}",
      mimeType: "application/json",
    };
    const waiting = { sectionIndex: 0, title: "Keyword research", status: "waiting" as const };
    expect(
      resolvePipelineSectionDownloadable(waiting, 0, [file], new Set(), null, {
        noFallback: true,
        requireDoneStatus: true,
      })?.name,
    ).toBe(file.name);
  });
});

describe("research pipeline step labels", () => {
  it("reserves pending label slots for waiting research steps after pipeline starts", () => {
    const sections = resolveDetailsPipelineSections(
      [
        { sectionIndex: 0, title: "DataForSEO SERP", status: "done" },
        { sectionIndex: 3, title: "LLM audit", status: "generating" },
      ],
      undefined,
      RESEARCH_HARNESS_SECTION_TITLES,
    );
    expect(sections.find((section) => section.title === "SERP dump load")?.status).toBe("waiting");
    expect(sections.find((section) => section.title === "Brief merge")?.status).toBe("waiting");
  });
});

describe("research pipeline downloads", () => {
  it("links LLM audit to research-*-llm-audit.json, not the harness status markdown", () => {
    const claimed = new Set<string>();
    const auditJson = '{"platforms":[{"status":"ok","responseText":"Solar facts"}]}';
    const files = [
      {
        name: "research-solar_panel_efficiency-llm-audit.json",
        content: auditJson,
        mimeType: "application/json",
      },
    ];
    const linked = resolvePipelineSectionDownloadable(
      {
        sectionIndex: 3,
        title: "LLM audit",
        status: "done",
        markdown: "LLM audit: 1/1 ok",
      },
      3,
      files,
      claimed,
      null,
      { researchArtifactsOnly: true },
    );
    expect(linked?.name).toBe("research-solar_panel_efficiency-llm-audit.json");
    expect(linked?.content).toBe(auditJson);
    expect(linked?.content).not.toContain("LLM audit:");
  });

  it("provides a placeholder download for research steps with no artifact yet", () => {
    const linked = resolvePipelineSectionDownloadable(
      {
        sectionIndex: 1,
        title: "GSC CSV",
        status: "done",
        markdown: "No GSC data",
      },
      1,
      [],
      new Set(),
      null,
      { researchArtifactsOnly: true },
    );
    expect(linked.name).toContain("GSC_CSV");
    expect(linked.content.trim()).toBeTruthy();
  });

  it("links brief upload to stored JSON content, not the harness status line", () => {
    const claimed = new Set<string>();
    const briefJson = '{"version":1,"focusKeyword":"solar"}';
    const files = [
      {
        name: "seo_brief__2026-08-27T18-04-1400-00__42076bdc.json",
        content: briefJson,
        mimeType: "application/json",
      },
    ];
    const linked = resolvePipelineSectionDownloadable(
      { sectionIndex: 7, title: "Brief upload", status: "done", markdown: "Brief saved: seo_brief__2026-08-27T18-04-1400-00__42076bdc.json" },
      7,
      files,
      claimed,
      null,
      { researchArtifactsOnly: true },
    );
    expect(linked?.content).toBe(briefJson);
    expect(linked?.content).not.toContain("Brief saved:");
  });

  it("links research SERP and LLM artifacts without strict noFallback", () => {
    const claimed = new Set<string>();
    const files = [
      {
        name: "research-solar-dataforseo-serp.json",
        content: '{"tasks":[]}',
        mimeType: "application/json",
      },
      {
        name: "research-solar-llm-audit.json",
        content: '{"platforms":[]}',
        mimeType: "application/json",
      },
    ];
    const serp = resolvePipelineSectionDownloadable(
      { sectionIndex: 0, title: "DataForSEO SERP", status: "done" },
      0,
      files,
      claimed,
      null,
    );
    expect(serp?.name).toBe("research-solar-dataforseo-serp.json");
    const llm = resolvePipelineSectionDownloadable(
      { sectionIndex: 3, title: "LLM audit", status: "done" },
      3,
      files,
      claimed,
      null,
    );
    expect(llm?.name).toBe("research-solar-llm-audit.json");
  });
});
