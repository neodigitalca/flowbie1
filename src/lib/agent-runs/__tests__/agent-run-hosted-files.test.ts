import { describe, expect, it, afterEach } from "vitest";
import {
  clearAgentRunHostedFiles,
  getAgentRunHostedFiles,
  syncAgentRunHostedFilesFromBulk,
} from "@/lib/agent-runs/agent-run-hosted-files";
import type { BulkGeneratedFile } from "@/lib/bulk-file-manager";

function stubFile(partial: Partial<BulkGeneratedFile> & Pick<BulkGeneratedFile, "id" | "fileName">): BulkGeneratedFile {
  return {
    rowIndex: 0,
    content: '{"ok":true}',
    mimeType: "application/json",
    status: "completed",
    timestamp: Date.now(),
    rowData: { keyword: "test", title: "Test" },
    ...partial,
  };
}

describe("agent-run-hosted-files", () => {
  afterEach(() => {
    clearAgentRunHostedFiles(99);
  });

  it("creates blob hosted links for completed bulk files", () => {
    syncAgentRunHostedFilesFromBulk(99, [
      stubFile({ id: "a", fileName: "blog-checklist-row-0.json", rowIndex: 0 }),
    ]);
    const files = getAgentRunHostedFiles(99);
    expect(files).toHaveLength(1);
    expect(files[0]?.name).toBe("blog-checklist-row-0.json");
    expect(files[0]?.href.startsWith("blob:")).toBe(true);
  });

  it("grows file list as new artifacts arrive", () => {
    syncAgentRunHostedFilesFromBulk(99, [
      stubFile({ id: "a", fileName: "checklist.json", rowIndex: 0 }),
    ]);
    syncAgentRunHostedFilesFromBulk(99, [
      stubFile({ id: "a", fileName: "checklist.json", rowIndex: 0 }),
      stubFile({ id: "b", fileName: "blueprint.json", rowIndex: 0 }),
    ]);
    expect(getAgentRunHostedFiles(99)).toHaveLength(2);
  });
});
