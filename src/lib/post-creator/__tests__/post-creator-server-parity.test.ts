import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import {
  computeHarnessSectionTokenBudgets,
} from "@/lib/bulk/harness-section-max-tokens";

const root = join(__dirname, "../../../..");
const exportedPhp = join(
  root,
  "wordpress-plugins/neo-pulse-app/includes/agent-runs/prompts/post-creator-exported-prompts.php",
);
const phpParityTest = join(
  root,
  "wordpress-plugins/neo-pulse-app/tests/test-post-creator-generator-parity.php",
);

describe("post creator server generator parity", () => {
  it("exports harness prompt fragments into PHP", () => {
    expect(existsSync(exportedPhp)).toBe(true);
    const src = readFileSync(exportedPhp, "utf8");
    expect(src).toContain("harness_section_length_rule_markdown");
    expect(src).toContain("HARNESS LENGTH (mandatory)");
    expect(src).toContain("checklist_system_prompt");
    expect(src).toContain("rename_intro_agent_title");
  });

  it("allocates 16k row budget across body + overview sections (TS reference)", () => {
    const bodyAgents = Array.from({ length: 5 }, (_, i) => ({
      sectionKey: `body-${i}`,
      agent: { step: i + 1, title: `Section ${i + 1}`, features: ["[LINK]: x"] },
      isOverview: false,
      isSeoOpener: i === 0,
    }));
    const sections = [
      { sectionKey: "overview", agent: { step: 0, title: "Overview", features: [] }, isOverview: true, bodySectionCount: 5 },
      ...bodyAgents,
    ];
    const slots = computeHarnessSectionTokenBudgets(sections, 16000);
    const allocated = slots.reduce((sum, s) => sum + s.maxTokens, 0);
    expect(allocated).toBe(16000);
    expect(slots.every((s) => s.maxTokens >= 256)).toBe(true);
  });

  it("passes PHP parity assertions (intro kept, 5+ body H2s, 16k tokens)", () => {
    expect(existsSync(phpParityTest)).toBe(true);
    const out = execSync(`php "${phpParityTest}"`, { encoding: "utf8", cwd: root });
    expect(out).toMatch(/OK: post creator generator parity/);
  });
});
