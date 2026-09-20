import { describe, expect, it } from "vitest";
import {
  csvTextToDataHref,
  downloadableCsvFromStepOutput,
} from "@/lib/workflow/workflow-rag-run-files";
import type { WorkflowStepOutput } from "@/lib/workflow/workflow-types";

describe("downloadableCsvFromStepOutput", () => {
  it("builds a download from page audit CSV text", () => {
    const output = {
      variableKey: "csv_rows_1",
      label: "Page audit",
      textPreview: "url,H2\nhttps://a.test/old/,\n",
      fileRefs: [{ name: "missing-template-posts.csv", mime: "text/csv" }],
    } as WorkflowStepOutput;

    const file = downloadableCsvFromStepOutput(output);
    expect(file?.name).toBe("missing-template-posts.csv");
    expect(file?.href).toBe(csvTextToDataHref(output.textPreview.trim()));
    expect(file?.outputKey).toBe("csv_rows_1");
  });

  it("returns null when the preview is not a CSV", () => {
    const output = {
      variableKey: "csv_rows_1",
      label: "Page audit",
      textPreview: "3 rows. First URL: https://a.test/",
      fileRefs: [],
    } as WorkflowStepOutput;
    expect(downloadableCsvFromStepOutput(output)).toBeNull();
  });
});
