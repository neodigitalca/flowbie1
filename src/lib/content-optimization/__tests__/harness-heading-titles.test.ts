import { describe, expect, it } from "vitest";
import {
  isGenericHarnessHeadingTitle,
  isLlmAuditAuthorityDumpChecklistItem,
  isLlmAuditAuthorityDumpTitle,
} from "@/lib/content-optimization/harness-heading-titles";

describe("isLlmAuditAuthorityDumpTitle", () => {
  it("flags numbered dump headings", () => {
    expect(isLlmAuditAuthorityDumpTitle("LLM Audit Authority Link 3")).toBe(true);
    expect(isLlmAuditAuthorityDumpTitle("Further Links 2")).toBe(true);
    expect(isGenericHarnessHeadingTitle("LLM Audit Authority Link 3")).toBe(true);
  });

  it("leaves topical titles alone", () => {
    expect(isLlmAuditAuthorityDumpTitle("CRA Online Mail for Individuals And Businesses")).toBe(
      false,
    );
  });
});

describe("isLlmAuditAuthorityDumpChecklistItem", () => {
  it("flags a row that is only the authority tag", () => {
    expect(
      isLlmAuditAuthorityDumpChecklistItem(
        "[LLM_AUDIT_AUTHORITY_LINK]: Weave [[EXTERNAL:https://www.edmonton.ca/|Edmonton]] mid-sentence.",
      ),
    ).toBe(true);
  });

  it("keeps a topical row that also carries the tag", () => {
    expect(
      isLlmAuditAuthorityDumpChecklistItem(
        "CRA Online Mail for Individuals And Businesses [STRUCTURE]: 2 paragraphs.\n[LLM_AUDIT_AUTHORITY_LINK]: Weave [[EXTERNAL:https://www.edmonton.ca/|Edmonton]] mid-sentence.",
      ),
    ).toBe(false);
  });
});
