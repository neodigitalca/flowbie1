import { describe, expect, it } from "vitest";
import { parseProgressFile } from "../../../browser-automation-jobs.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

describe("parseProgressFile deliverable streaming", () => {
  it("returns the latest deliverable event with csv content", () => {
    const progressPath = path.join(os.tmpdir(), `flowbie-deliverable-test-${Date.now()}.jsonl`);
    fs.writeFileSync(
      progressPath,
      [
        JSON.stringify({ type: "step", label: "Site audit 1/3: /" }),
        JSON.stringify({
          type: "deliverable",
          filename: "site-audit-example.com.csv",
          label: "Site audit report (1/3)",
          mime: "text/csv",
          kind: "csv",
          content: "url,status_code\nhttps://example.com/,200",
          rowIndex: 1,
          rowTotal: 3,
        }),
      ].join("\n"),
      "utf8",
    );

    const parsed = parseProgressFile(progressPath);
    expect(parsed.deliverable?.filename).toBe("site-audit-example.com.csv");
    expect(parsed.deliverable?.content).toContain("https://example.com/");
    expect(parsed.deliverable?.rowIndex).toBe(1);

    fs.unlinkSync(progressPath);
  });
});
