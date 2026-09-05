import { describe, expect, it } from "vitest";
import { isWorkflowDeliverableArtifact } from "@/lib/workflow/workflow-step-file-refs";

describe("isWorkflowDeliverableArtifact", () => {
  it("includes browser_capture JPEG deliverables", () => {
    expect(
      isWorkflowDeliverableArtifact({
        name: "homepage-screenshot.jpg",
        mime: "image/jpeg",
        stepKey: "browser_capture",
      }),
    ).toBe(true);
  });

  it("excludes live browser preview frames", () => {
    expect(
      isWorkflowDeliverableArtifact({
        name: "browser-preview.jpg",
        mime: "image/jpeg",
        stepKey: "browser_preview",
      }),
    ).toBe(false);
  });

  it("includes browser_deliverable text and csv artifacts", () => {
    expect(
      isWorkflowDeliverableArtifact({
        name: "html-audit-issues.csv",
        mime: "text/csv",
        stepKey: "browser_deliverable",
      }),
    ).toBe(true);
    expect(
      isWorkflowDeliverableArtifact({
        name: "html-audit-fix-plan.md",
        mime: "text/markdown",
        stepKey: "browser_deliverable",
      }),
    ).toBe(true);
  });

  it("includes jpeg by extension when stepKey is browser_capture", () => {
    expect(
      isWorkflowDeliverableArtifact({
        name: "client-home.jpeg",
        stepKey: "browser_capture",
      }),
    ).toBe(true);
  });
});
