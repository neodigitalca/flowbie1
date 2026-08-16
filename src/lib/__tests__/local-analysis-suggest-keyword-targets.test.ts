import { describe, it, expect } from "vitest";
import {
  repairSapPageAllocation,
  repairSapPageAllocationWeighted,
} from "../local-analysis-suggest-keyword-targets";

describe("repairSapPageAllocation", () => {
  it("distributes total across rows with min/max bounds", () => {
    const out = repairSapPageAllocation(
      [
        { keyword: "a", sapPages: 99 },
        { keyword: "b", sapPages: 1 },
        { keyword: "c", sapPages: 1 },
      ],
      15,
      1,
      50
    );
    expect(out).toHaveLength(3);
    const sum = out.reduce((s, r) => s + r.sapPages, 0);
    expect(sum).toBe(15);
    expect(out.every((r) => r.sapPages >= 1 && r.sapPages <= 50)).toBe(true);
  });

  it("duplicates the last keyword until enough capacity for a large total", () => {
    const out = repairSapPageAllocation([{ keyword: "blinds phoenix", sapPages: 999 }], 200, 1, 50);
    expect(out.length).toBe(4);
    expect(out.every((r) => r.keyword === "blinds phoenix")).toBe(true);
    expect(out.reduce((s, r) => s + r.sapPages, 0)).toBe(200);
    expect(out.every((r) => r.sapPages === 50)).toBe(true);
  });

  it("drops excess keywords when total cannot satisfy min per row", () => {
    const out = repairSapPageAllocation(
      [
        { keyword: "a", sapPages: 1 },
        { keyword: "b", sapPages: 1 },
        { keyword: "c", sapPages: 1 },
      ],
      2,
      1,
      50
    );
    expect(out).toHaveLength(2);
    expect(out.reduce((s, r) => s + r.sapPages, 0)).toBe(2);
  });

  it("accepts totals above the former 200 cap", () => {
    const out = repairSapPageAllocation(
      [{ keyword: "x", sapPages: 1 }],
      250,
      1,
      50,
    );
    expect(out.reduce((s, r) => s + r.sapPages, 0)).toBe(250);
  });

  it("allocates when total is below per-target min (e.g. budget 1, min 3)", () => {
    const out = repairSapPageAllocationWeighted(
      [{ keyword: "blinds", sapPages: 3 }],
      [10],
      1,
      3,
      50,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.sapPages).toBe(1);
  });
});

describe("repairSapPageAllocationWeighted", () => {
  it("gives more SAP pages to higher-weight keywords when totals allow", () => {
    const out = repairSapPageAllocationWeighted(
      [
        { keyword: "a", sapPages: 1 },
        { keyword: "b", sapPages: 1 },
      ],
      [1, 20],
      24,
      1,
      50
    );
    const a = out.find((r) => r.keyword === "a");
    const b = out.find((r) => r.keyword === "b");
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(b!.sapPages).toBeGreaterThan(a!.sapPages);
    expect(out.reduce((s, r) => s + r.sapPages, 0)).toBe(24);
  });
});
