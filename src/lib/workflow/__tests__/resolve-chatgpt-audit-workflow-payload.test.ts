import { describe, expect, it } from "vitest";
import {
  ensureChatGptAuditExecutionPayload,
  normalizeChatGptAuditTargetBucket,
} from "@/lib/workflow/resolve-chatgpt-audit-workflow-payload";

describe("ensureChatGptAuditExecutionPayload", () => {
  it("defaults missing bucket to pages", () => {
    expect(ensureChatGptAuditExecutionPayload({ saveLocalArchive: true })).toEqual({
      saveLocalArchive: true,
      targetBucket: "pages",
    });
  });

  it("keeps explicit targetUrls without adding bucket", () => {
    expect(
      ensureChatGptAuditExecutionPayload({
        targetUrls: ["https://example.com/a", "https://example.com/b"],
      }),
    ).toEqual({
      targetUrls: ["https://example.com/a", "https://example.com/b"],
    });
  });

  it("keeps an explicit bucket", () => {
    expect(ensureChatGptAuditExecutionPayload({ targetBucket: "all" })).toEqual({
      targetBucket: "all",
    });
  });
});

describe("normalizeChatGptAuditTargetBucket", () => {
  it("falls back to pages for invalid values", () => {
    expect(normalizeChatGptAuditTargetBucket("")).toBe("pages");
    expect(normalizeChatGptAuditTargetBucket("nope")).toBe("pages");
  });

  it("preserves valid buckets", () => {
    expect(normalizeChatGptAuditTargetBucket("sap")).toBe("sap");
  });
});
