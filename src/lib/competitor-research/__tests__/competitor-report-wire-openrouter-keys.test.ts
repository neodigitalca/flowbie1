import { describe, expect, it } from "vitest";
import { shortenWireKeysForOpenRouterPayload } from "@/lib/competitor-research/competitor-report-wire-openrouter-keys";

describe("shortenWireKeysForOpenRouterPayload", () => {
  it("renames scsv to scv and ekrM to ekM", () => {
    const out = shortenWireKeysForOpenRouterPayload({
      scsv: { x: "a" },
      ekrM: [[]],
      ssc: "h",
    });
    expect(out.scv).toEqual({ x: "a" });
    expect(out.ekM).toEqual([[]]);
    expect(out.scsv).toBeUndefined();
    expect(out.ekrM).toBeUndefined();
  });
});
