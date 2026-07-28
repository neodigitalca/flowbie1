import { describe, expect, it } from "vitest";
import {
  formatHeadersApplyMarkdown,
  formatHeadersPlanMarkdown,
  formatHeadersVerifyMarkdown,
} from "@/lib/overview/overview-blog-headers-harness-sections";

const before = [
  "What is QuickBooks Online?",
  "Should You Migrate to the Cloud?",
  "How to Customize Your QuickBooks Online Setup",
  "QuickBooks Online Support for Auto Repair Business Owners",
];

const plan = {
  h2Actions: [
    {
      action: "optimize" as const,
      index: 0,
      proposedText:
        "What is QuickBooks Online and Why is it Important for Your Business?",
      rationale: "",
    },
    {
      action: "optimize" as const,
      index: 1,
      proposedText: "Should Your Auto Repair Business Migrate to QuickBooks Online?",
      rationale: "",
    },
    {
      action: "add" as const,
      index: 3,
      proposedText: "Key Strategies for QuickBooks Online Optimization in Auto Repair",
      rationale: "",
    },
    {
      action: "optimize" as const,
      index: 2,
      proposedText: "How KKB Helps Customize Your QuickBooks Online Setup for Optimization",
      rationale: "",
    },
    {
      action: "optimize" as const,
      index: 3,
      proposedText: "Ongoing QuickBooks Online Support for Auto Repair Business Owners from KWB",
      rationale: "",
    },
  ],
};

const after = [
  "What is QuickBooks Online and Why is it Important for Your Business?",
  "Should Your Auto Repair Business Migrate to QuickBooks Online?",
  "How KKB Helps Customize Your QuickBooks Online Setup for Optimization",
  "Key Strategies for QuickBooks Online Optimization in Auto Repair",
  "Ongoing QuickBooks Online Support for Auto Repair Business Owners from KWB",
];

describe("headers harness markdown", () => {
  it("plan labels optimize add and keep", () => {
    const md = formatHeadersPlanMarkdown(plan, before);
    expect(md).toContain("PLAN SUMMARY: 4 OPTIMIZE | 1 ADD | 0 KEEP");
    expect(md).toContain("OPTIMIZE (rewrite existing H2 text only):");
    expect(md).toContain("ADD (insert new H2");
    expect(md).toContain("WAS: What is QuickBooks Online?");
  });

  it("apply tags final list with ADDED and OPTIMIZED", () => {
    const md = formatHeadersApplyMarkdown(before, after, plan);
    expect(md).toContain("APPLIED: 4 optimized | 1 added");
    expect(md).toContain("CHANGES EXECUTED:");
    expect(md).toContain("[ADDED]");
    expect(md).toContain("[OPTIMIZED]");
    expect(md).toContain("H2 count: 4 → 5");
  });

  it("verify summarizes counts", () => {
    const md = formatHeadersVerifyMarkdown(before, after, plan, true);
    expect(md).toContain("VERIFY: PASSED");
    expect(md).toContain("Added: 1");
    expect(md).toContain("Final H2 count: 5 (started with 4)");
  });
});
