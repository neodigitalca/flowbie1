import { describe, expect, it } from "vitest";
import { isTransientMcpError } from "@/lib/mcp-tools";

describe("isTransientMcpError", () => {
  it("treats gateway timeout status codes as transient", () => {
    expect(isTransientMcpError("", 504)).toBe(true);
    expect(isTransientMcpError("", 502)).toBe(true);
    expect(isTransientMcpError("", 503)).toBe(true);
  });

  it("treats nginx gateway timeout HTML as transient", () => {
    expect(
      isTransientMcpError(
        "MCP API error (504): 504 Gateway Time-out nginx",
        504,
      ),
    ).toBe(true);
  });

  it("does not treat validation errors as transient", () => {
    expect(isTransientMcpError("keyword is required", 400)).toBe(false);
  });
});
