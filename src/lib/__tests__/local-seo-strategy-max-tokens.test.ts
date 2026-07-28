import { describe, expect, it } from "vitest";
import { sapJsonRowTokenFloor } from "@/lib/local-seo-strategy-from-grid";

describe("SAP JSON output tokens", () => {
  it("row token floor scales with SAP count (observability only)", () => {
    expect(sapJsonRowTokenFloor(45)).toBe(73_000);
  });
});
