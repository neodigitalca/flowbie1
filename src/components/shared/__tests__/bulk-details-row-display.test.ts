import { describe, expect, it } from "vitest";
import { rowFilesToDownloadables } from "@/components/shared/bulk-details-row-display";
import type { BulkGeneratedFile } from "@/lib/bulk-file-manager";

function mockFile(partial: Partial<BulkGeneratedFile> & Pick<BulkGeneratedFile, "status">): BulkGeneratedFile {
  return {
    id: "test-id",
    rowIndex: 0,
    fileName: "test.md",
    fileType: "content",
    content: "body",
    mimeType: "text/markdown",
    rowData: { title: "Test", keyword: "kw" },
    timestamp: 0,
    ...partial,
  };
}

describe("rowFilesToDownloadables", () => {
  it("includes completed files", () => {
    const result = rowFilesToDownloadables([mockFile({ status: "completed" })]);
    expect(result).toHaveLength(1);
  });

  it("includes error files with content", () => {
    const result = rowFilesToDownloadables([
      mockFile({ status: "error", content: "partial blueprint" }),
    ]);
    expect(result).toHaveLength(1);
  });

  it("excludes error files without content", () => {
    const result = rowFilesToDownloadables([mockFile({ status: "error", content: "" })]);
    expect(result).toHaveLength(0);
  });

  it("excludes pending and generating files", () => {
    const result = rowFilesToDownloadables([
      mockFile({ status: "pending" }),
      mockFile({ status: "generating" }),
    ]);
    expect(result).toHaveLength(0);
  });
});
