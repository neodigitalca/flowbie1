import { describe, expect, it } from "vitest";
import {
  countSapMapsRowsByEntity,
  createSapMapsMediaBank,
  getSapMapsMediaId,
  sapMapsImageFileName,
  sapMapsMediaTitleAlt,
  sapMapsReuseProgressLabel,
  sapMapsSiteEntityKey,
  setSapMapsMediaId,
} from "@/lib/bulk/sap-maps-media-bank";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";

function row(partial: Partial<CSVRow> & { keyword: string }): CSVRow {
  return {
    keyword: partial.keyword,
    entity: partial.entity,
    title: partial.title ?? "",
    featuredImage: partial.featuredImage ?? "google-maps",
  };
}

describe("sap-maps-media-bank", () => {
  it("keys site + entity with normalized ad-group entity", () => {
    expect(sapMapsSiteEntityKey("site-1", "  Aldergrove  ")).toBe("site-1::aldergrove");
    expect(sapMapsSiteEntityKey("site-1", "Aldergrove")).toBe(
      sapMapsSiteEntityKey("site-1", "aldergrove"),
    );
  });

  it("stores and reuses media ids per site and entity", () => {
    const bank = createSapMapsMediaBank();
    setSapMapsMediaId(bank, "s1", "Aldergrove", 101);
    setSapMapsMediaId(bank, "s2", "Aldergrove", 202);
    expect(getSapMapsMediaId(bank, "s1", "aldergrove")).toBe(101);
    expect(getSapMapsMediaId(bank, "s2", "  Aldergrove ")).toBe(202);
    expect(getSapMapsMediaId(bank, "s1", "Abbotsfield")).toBeUndefined();
  });

  it("counts rows per location entity (not keyword)", () => {
    const counts = countSapMapsRowsByEntity([
      row({ keyword: "Audit Services in Aldergrove", entity: "Aldergrove" }),
      row({ keyword: "Accounting Services in Aldergrove", entity: "Aldergrove" }),
      row({ keyword: "Tax Accountant in Abbotsfield", entity: "Abbotsfield" }),
      row({ keyword: "No entity", entity: "N/A" }),
      row({ keyword: "Blank entity", entity: "" }),
    ]);
    expect(counts.get("aldergrove")).toBe(2);
    expect(counts.get("abbotsfield")).toBe(1);
    expect(counts.size).toBe(2);
  });

  it("builds title/alt and deterministic filename", () => {
    expect(sapMapsMediaTitleAlt("Aldergrove")).toBe("google maps image of Aldergrove");
    expect(sapMapsImageFileName("Aldergrove, Edmonton")).toBe(
      "aldergrove-edmonton-google-maps.jpg",
    );
    expect(sapMapsImageFileName("Aldergrove", "png")).toBe("aldergrove-google-maps.png");
  });

  it("labels first upload vs reuse", () => {
    expect(sapMapsReuseProgressLabel("Aldergrove", 12, false)).toBe(
      "Google Maps for Aldergrove (1 upload, 12 SAP pages)",
    );
    expect(sapMapsReuseProgressLabel("Aldergrove", 12, true)).toBe(
      "Reusing Google Maps image for Aldergrove (12 SAP pages share this location)",
    );
  });
});
