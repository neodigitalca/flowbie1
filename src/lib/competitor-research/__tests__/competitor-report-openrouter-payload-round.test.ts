import { describe, expect, it } from "vitest";
import {
  roundNumericValuesDeep,
  roundSemrushCsvStringNumbers,
  roundWirePayloadForOpenRouterJson,
} from "@/lib/competitor-research/competitor-report-openrouter-payload-round";
import { OPENROUTER_SSC_SCV_ROW_SEP } from "@/lib/competitor-research/competitor-report-wire-openrouter-keys";

describe("roundNumericValuesDeep", () => {
  it("rounds nested numbers to integers", () => {
    expect(
      roundNumericValuesDeep({
        a: 1.7,
        b: [2.2, 3.9],
        c: { d: 84.17000000000002 },
      }),
    ).toEqual({
      a: 2,
      b: [2, 4],
      c: { d: 84 },
    });
  });

  it("leaves non-numbers unchanged", () => {
    expect(roundNumericValuesDeep({ s: "x", n: null, z: true })).toEqual({ s: "x", n: null, z: true });
  });
});

describe("roundSemrushCsvStringNumbers", () => {
  it("preserves header and rounds Volume, Traffic, Position", () => {
    const csv = [
      "Keyword,Volume,Traffic,Position",
      "Invisalign Edmonton,680,84.17000000000002,1",
      "Gum Issues,420,5.859999999999999,5",
    ].join("\n");
    const out = roundSemrushCsvStringNumbers(csv);
    expect(out).toContain("680,84,1");
    expect(out).toContain("420,6,5");
    expect(out.startsWith("Keyword,Volume,Traffic,Position")).toBe(true);
  });
});

describe("roundWirePayloadForOpenRouterJson", () => {
  it("rounds structured numbers and CSV strings; RS row sep; short keys scv", () => {
    const payload = {
      tp: {
        sTr: 335.53,
        sVol: 68860,
        kwR: 46,
        Pt: 9,
        avgCompOTr: 100.2,
        nCompOTr: 3,
        seedOTr: 50.4,
        gapTr: 12.3,
        rM: [10.4, 20.6],
        rS: [20.6, 40.1],
        rD: [40.1, 60.0],
        N: "note",
      },
      ssc: "Keyword,Volume,Traffic,Position\nFoo,1,2.2,3.7\n",
      scsv: {
        "a.com": "Keyword,Volume,Traffic,Position\nBar,10,11.6,12.4\n",
      },
    };
    const r = roundWirePayloadForOpenRouterJson(payload) as Record<string, unknown>;
    expect((r.tp as { sTr: number }).sTr).toBe(336);
    expect(r.ssc).toContain("1,2,4");
    expect(r.ssc).toContain(OPENROUTER_SSC_SCV_ROW_SEP);
    expect(String(r.ssc)).not.toContain("\n");
    const scv = r.scv as Record<string, string>;
    expect(scv["a.com"]).toContain("10,12,12");
    expect(scv["a.com"]).toContain(OPENROUTER_SSC_SCV_ROW_SEP);
    expect(r.scsv).toBeUndefined();
  });

  it("stringify produces no decimal digits in numeric fields for a minimal wire slice", () => {
    const payload = {
      sk: [["x", 1.1, 2.9, 3.4]],
      gq: [["q", 1, 2, 0.0025, 4.7]],
    };
    const r = roundWirePayloadForOpenRouterJson(payload);
    const s = JSON.stringify(r);
    expect(s).not.toMatch(/1\.1|2\.9|0\.0025/);
  });
});
