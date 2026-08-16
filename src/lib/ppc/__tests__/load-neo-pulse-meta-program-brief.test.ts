import { describe, expect, it } from "vitest";
import {
  NEO_PULSE_META_PROGRAM_BRIEF_MAX_CHARS,
  getNeoPulseMetaProgramBrief,
  getNeoPulseMetaProgramBriefMarkdown,
} from "@/lib/ppc/load-neo-pulse-meta-program-brief";

describe("load-neo-pulse-meta-program-brief", () => {
  it("loads the static program brief", () => {
    const brief = getNeoPulseMetaProgramBrief();
    expect(brief).toContain("NEO Pulse");
    expect(brief).toContain("Program modules");
    expect(brief).toContain("Designed Instagram feed");
    expect(brief).toContain("Reference ad patterns");
    expect(brief).not.toContain("Default agency device");
    expect(brief).not.toContain("Elementor editor on laptop");
    expect(brief.length).toBeLessThanOrEqual(NEO_PULSE_META_PROGRAM_BRIEF_MAX_CHARS);
  });

  it("wraps markdown with a heading when needed", () => {
    const markdown = getNeoPulseMetaProgramBriefMarkdown();
    expect(markdown.startsWith("# NEO Pulse program brief")).toBe(true);
    expect(markdown).toContain("Visual reference planning");
  });
});
