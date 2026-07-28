import { describe, expect, it } from "vitest";
import {
  buildPlannedFaqPairSections,
  buildWaitingFaqHarnessSections,
  formatFaqPairMarkdown,
  makeFaqPairHarnessDonePayload,
  makeFaqPairHarnessStartPayload,
  faqHarnessGeneratedFiles,
} from "@/lib/overview/overview-faq-harness-sections";
import { reduceHarnessSectionList } from "@/lib/bulk/harness-sections-reducer";

describe("buildPlannedFaqPairSections", () => {
  it("plans four pair sections by default seed count", () => {
    const planned = buildPlannedFaqPairSections(4);
    expect(planned).toHaveLength(4);
    expect(planned.map((s) => s.title)).toEqual(["FAQ 1", "FAQ 2", "FAQ 3", "FAQ 4"]);
    expect(planned.map((s) => s.sectionIndex)).toEqual([0, 1, 2, 3]);
  });
});

describe("faq harness payloads", () => {
  it("reduces start then done into a completed section with markdown", () => {
    let sections = buildWaitingFaqHarnessSections(1);
    for (const payload of [
      makeFaqPairHarnessStartPayload(0, 0, 1, 0),
      makeFaqPairHarnessDonePayload(0, 0, 1, 0, {
        question: "What is chiropractic care?",
        answer: "Hands-on treatment for the spine and joints.",
      }),
    ]) {
      sections = reduceHarnessSectionList(sections, payload);
    }
    expect(sections).toHaveLength(1);
    expect(sections[0]?.status).toBe("done");
    expect(sections[0]?.markdown).toBe(
      formatFaqPairMarkdown(
        "What is chiropractic care?",
        "Hands-on treatment for the spine and joints.",
      ),
    );

    const files = faqHarnessGeneratedFiles(sections, "https://example.com/chiropractic/");
    expect(files).toHaveLength(1);
    expect(files[0]?.name).toContain("faq-");
    expect(files[0]?.content).toContain("chiropractic care?");
  });
});
