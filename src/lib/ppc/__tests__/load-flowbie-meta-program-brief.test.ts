import { describe, expect, it } from "vitest";
import {
  FLOWBIE_META_PROGRAM_BRIEF_MAX_CHARS,
  getFlowbieMetaProgramBrief,
  getFlowbieMetaProgramBriefMarkdown,
} from "@/lib/ppc/load-flowbie-meta-program-brief";

describe("load-flowbie-meta-program-brief", () => {
  it("loads the static program brief", () => {
    const brief = getFlowbieMetaProgramBrief();
    expect(brief).toContain("FlowbieONE");
    expect(brief).toContain("Program modules");
    expect(brief).toContain("Designed Instagram feed");
    expect(brief).toContain("Reference ad patterns");
    expect(brief).not.toContain("Default agency device");
    expect(brief).not.toContain("Elementor editor on laptop");
    expect(brief.length).toBeLessThanOrEqual(FLOWBIE_META_PROGRAM_BRIEF_MAX_CHARS);
  });

  it("wraps markdown with a heading when needed", () => {
    const markdown = getFlowbieMetaProgramBriefMarkdown();
    expect(markdown.startsWith("# FlowbieONE program brief")).toBe(true);
    expect(markdown).toContain("Visual reference planning");
  });
});
