import { COMPETITOR_BULK_CSV_TOTAL_POSTS } from "@/lib/competitor-research/competitor-bulk-content-csv";
import { describe, expect, it } from "vitest";
import {
  mergeSummarizedWirePreserveDataTables,
  type CompetitorReportWirePayload,
} from "@/lib/competitor-research/competitor-report-wire";

const minimalWire = (): CompetitorReportWirePayload => ({
  sd: "a.com",
  db: "us",
  sm: null,
  so: null,
  kc: ["Kw", "Vol", "Tr", "Pos"],
  sk: [["seed kw", 1, 2, 3]],
  skM: [[]],
  src: ["Dom", "CK", "OTr", "OKw", "Comp", "AS", "RD", "BL"],
  sr: [["b.com", 1, 2, 3, 4, 5, 6, 7]],
  ekc: ["Dom", "Kw", "Vol", "Tr", "Pos"],
  dm: ["b.com"],
  ekr: [[0, "dentist city", 100, 1, 10]],
  ekrM: [[]],
  gc: ["Qry", "Clk", "Imp", "CTR", "Pos"],
  gq: [["q", 1, 2, 3, 4]],
  ta: { Sum: "x", tcc: ["Dom", "Scr", "Rsn"], ti: [] },
  dg: { skc: 1, gqc: 1, overlap: "o", errc: 0 },
  lb: "lb",
  n: "n",
  err: [],
  gdr: null,
  cl: null,
  sn: undefined,
  su: undefined,
  ssc: "",
  scsv: {},
  tp: {
    sTr: 3,
    sVol: 101,
    kwR: 2,
    Pt: COMPETITOR_BULK_CSV_TOTAL_POSTS,
    avgCompOTr: 2,
    nCompOTr: 1,
    seedOTr: null,
    gapTr: null,
    rM: [5, 9],
    rS: [9, 18],
    rD: [18, 30],
    N: "test note",
  },
});

describe("mergeSummarizedWirePreserveDataTables", () => {
  it("restores sk,sr,ekr,gq from canonical wire when summarize mutates arrays", () => {
    const wire = minimalWire();
    const summarized = {
      ...wire,
      sk: [["hallucinated", 9, 9, 9]],
      skM: [[""]],
      dm: ["evil.com"],
      ekr: [[0, "brand dental", 0, 0, 1]],
      ekrM: [["bad"]],
      tp: {
        sTr: 999,
        sVol: 999,
        kwR: 99,
        Pt: 0,
        avgCompOTr: 0,
        nCompOTr: 0,
        seedOTr: null,
        gapTr: null,
        rM: null,
        rS: null,
        rD: null,
        N: "fake",
      },
      ta: { ...wire.ta, Sum: "shortened summary" },
    };
    const merged = mergeSummarizedWirePreserveDataTables(wire, summarized);
    expect(merged.sk).toEqual(wire.sk);
    expect(merged.skM).toEqual(wire.skM);
    expect(merged.sr).toEqual(wire.sr);
    expect(merged.ekr).toEqual(wire.ekr);
    expect(merged.ekrM).toEqual(wire.ekrM);
    expect(merged.dm).toEqual(wire.dm);
    expect(merged.gq).toEqual(wire.gq);
    expect(merged.ssc).toEqual(wire.ssc);
    expect(merged.scsv).toEqual(wire.scsv);
    expect(merged.tp).toEqual(wire.tp);
    expect(merged.ta.Sum).toBe("shortened summary");
  });

  it("restores ssc,scsv from canonical wire when summarize mutates them", () => {
    const wire = minimalWire();
    wire.ssc = "Keyword,Volume\nx,1\n";
    wire.scsv = { "a.com": "Keyword,Volume\ny,2\n" };
    const summarized = {
      ...wire,
      ssc: "fake",
      scsv: { "b.com": "bad" },
      ta: { ...wire.ta, Sum: "x" },
    };
    const merged = mergeSummarizedWirePreserveDataTables(wire, summarized);
    expect(merged.ssc).toBe(wire.ssc);
    expect(merged.scsv).toEqual(wire.scsv);
  });

  it("drops OpenRouter serialize aliases scv/ekM if the model echoes them", () => {
    const wire = minimalWire();
    const summarized = {
      ...wire,
      ta: { ...wire.ta, Sum: "x" },
      scv: { "evil.com": "bad" },
      ekM: [["should", "not", "persist"]],
    };
    const merged = mergeSummarizedWirePreserveDataTables(wire, summarized);
    expect(merged.scsv).toEqual(wire.scsv);
    expect((merged as Record<string, unknown>).scv).toBeUndefined();
    expect((merged as Record<string, unknown>).ekM).toBeUndefined();
  });

  it("returns wire when summarized is not an object", () => {
    const wire = minimalWire();
    expect(mergeSummarizedWirePreserveDataTables(wire, null)).toBe(wire);
    expect(mergeSummarizedWirePreserveDataTables(wire, [])).toBe(wire);
  });
});
