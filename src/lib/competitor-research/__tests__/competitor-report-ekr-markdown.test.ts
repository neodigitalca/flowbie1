import { COMPETITOR_BULK_CSV_TOTAL_POSTS } from "@/lib/competitor-research/competitor-bulk-content-csv";
import { describe, expect, it } from "vitest";
import {
  renderAttackableKeywordsFromEkr,
  renderKeywordsTheyOwnAppendix,
} from "@/lib/competitor-research/competitor-report-ekr-markdown";
import type { CompetitorReportWirePayload } from "@/lib/competitor-research/competitor-report-wire";

function minimalWire(overrides: Partial<CompetitorReportWirePayload> = {}): CompetitorReportWirePayload {
  return {
    sd: "seed.com",
    db: "us",
    sm: null,
    so: null,
    kc: ["Kw", "Vol", "Tr", "Pos"],
    sk: [],
    src: ["Dom", "CK", "OTr", "OKw", "Comp", "AS", "RD", "BL"],
    sr: [],
    ekc: ["Dom", "Kw", "Vol", "Tr", "Pos"],
    dm: [],
    ekr: [],
    gc: ["Qry", "Clk", "Imp", "CTR", "Pos"],
    gq: [],
    ta: { Sum: "x", tcc: ["Dom", "Scr", "Rsn"], ti: [] },
    dg: { skc: 0, gqc: 0, overlap: "o", errc: 0 },
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
      sTr: null,
      sVol: null,
      kwR: 0,
      Pt: COMPETITOR_BULK_CSV_TOTAL_POSTS,
      avgCompOTr: null,
      nCompOTr: 0,
      seedOTr: null,
      gapTr: null,
      rM: null,
      rS: null,
      rD: null,
      N: "fixture",
    },
    ...overrides,
  };
}

describe("renderKeywordsTheyOwnAppendix", () => {
  it("returns empty string when ekr and sk have no rows", () => {
    expect(renderKeywordsTheyOwnAppendix(minimalWire({ sr: [["x.com", 1, 1, 1, 0, 1, null, null]] }))).toBe("");
  });

  it("renders seed table when sk has rows but ekr is empty", () => {
    const md = renderKeywordsTheyOwnAppendix(
      minimalWire({
        sk: [["seed phrase", 10, 5, 2]],
        ekr: [],
        sr: [],
      }),
    );
    expect(md).toContain("### **Seed site**");
    expect(md).toContain("*seed.com*");
    expect(md).toContain("| seed phrase | 10 | 5 | 2 |");
  });

  it("uses ### **domain** then keyword tables only (Semrush phrases), sr order when present", () => {
    const md = renderKeywordsTheyOwnAppendix(
      minimalWire({
        sr: [["smilesdentalgroup.com", 10, 5000, 2000, 0.5, 42, 100, 500]],
        dm: ["smilesdentalgroup.com"],
        ekr: [[0, "dental implants edmonton", 100, 250, 1]],
      }),
    );
    expect(md).toMatch(/^## \*\*Keywords They Own\*\*\s*\n/);
    expect(md).toContain("### **smilesdentalgroup.com**");
    expect(md).toContain("| dental implants edmonton | 100 | 250 | 1 |");
    expect(md).not.toContain("| Metric | Value |");
  });

  it("uses cluster table headers when ekrM has members", () => {
    const md = renderKeywordsTheyOwnAppendix(
      minimalWire({
        sr: [["x.com", 1, 1, 1, 0, 1, null, null]],
        dm: ["x.com"],
        ekr: [[0, "Invisalign", 100, 10, 5]],
        ekrM: [["a", "b"]],
      }),
    );
    expect(md).toContain("| Cluster | Σ Volume | Σ Traffic | Best position | Member phrases (Semrush) |");
    expect(md).toContain("| Invisalign | 100 | 10 | 5 | a; b |");
  });

  it("formats cluster metrics as rounded integers with thousands separators", () => {
    const md = renderKeywordsTheyOwnAppendix(
      minimalWire({
        sr: [["x.com", 1, 1, 1, 0, 1, null, null]],
        dm: ["x.com"],
        ekr: [[0, "Mouth & Lip", 21550, 16.529999999999998, 1]],
        ekrM: [["a", "b"]],
      }),
    );
    expect(md).toContain("| Mouth & Lip | 21,550 | 17 | 1 |");
  });

  it("uses one pipe table per domain even with many keyword rows", () => {
    const rows: CompetitorReportWirePayload["ekr"] = [];
    for (let i = 0; i < 7; i++) {
      rows.push([0, `kw ${i}`, i, i, i]);
    }
    const md = renderKeywordsTheyOwnAppendix(
      minimalWire({
        sr: [["x.com", 1, 1, 1, 0, 1, null, null]],
        dm: ["x.com"],
        ekr: rows,
      }),
    );
    const headerCount = md.split("| Keyword phrase | Volume | Traffic | Position |").length - 1;
    expect(headerCount).toBe(1);
  });
});

describe("renderAttackableKeywordsFromEkr", () => {
  it("renders nothing when ekr has no rows", () => {
    expect(renderAttackableKeywordsFromEkr([], [])).toBe("");
  });

  it("renders ### **domain** then pipe tables grouped by domain from Semrush tuples", () => {
    const md = renderAttackableKeywordsFromEkr(
      [
        [0, "dentist city", 100, 1, 9],
        [1, "teeth cleaning", 50, 2, 12],
      ],
      ["b.com", "a.com"],
    );
    expect(md).toContain("### **a.com**");
    expect(md).toContain("### **b.com**");
    expect(md).toContain("| dentist city | 100 | 1 | 9 |");
    expect(md).toContain("| teeth cleaning | 50 | 2 | 12 |");
  });

  it("escapes pipes in keyword phrase cells", () => {
    const md = renderAttackableKeywordsFromEkr([[0, "a|b", 1, 2, 3]], ["x.com"]);
    expect(md).toContain("a\\|b");
  });
});
