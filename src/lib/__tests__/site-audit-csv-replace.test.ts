import { describe, expect, it } from "vitest";
import { progressDeliverableCommitSignature } from "@/lib/agent-runs/run-browser-automation-client-harness";
import { dedupeWorkflowRagFilesByName } from "@/lib/workflow/workflow-rag-run-files";

describe("progressDeliverableCommitSignature", () => {
  it("uses filename and content length for streaming csv updates", () => {
    const first = progressDeliverableCommitSignature(
      { filename: "site-audit-example.com.csv", kind: "csv", rowIndex: 1 },
      120,
    );
    const second = progressDeliverableCommitSignature(
      { filename: "site-audit-example.com.csv", kind: "csv", rowIndex: 2 },
      240,
    );
    const duplicate = progressDeliverableCommitSignature(
      { filename: "site-audit-example.com.csv", kind: "csv", rowIndex: 3 },
      240,
    );

    expect(first).toBe("site-audit-example.com.csv:120");
    expect(second).toBe("site-audit-example.com.csv:240");
    expect(second).not.toBe(first);
    expect(duplicate).toBe(second);
  });

  it("includes rowIndex for non-streaming deliverables", () => {
    expect(
      progressDeliverableCommitSignature(
        { filename: "capture.jpg", kind: "image", rowIndex: 4 },
        9000,
      ),
    ).toBe("capture.jpg:9000:4");
  });
});

describe("dedupeWorkflowRagFilesByName", () => {
  it("keeps the last file per name", () => {
    const files = dedupeWorkflowRagFilesByName([
      { name: "site-audit-a.csv", href: "https://x/a1", outputKey: "a", sizeBytes: 1 },
      { name: "report.md", href: "https://x/b", outputKey: "b", sizeBytes: 2 },
      { name: "site-audit-a.csv", href: "https://x/a2", outputKey: "a", sizeBytes: 3 },
    ]);

    expect(files).toHaveLength(2);
    expect(files.find((file) => file.name === "site-audit-a.csv")?.href).toBe("https://x/a2");
  });
});
