import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";

const lookupEntityHintWikipedia = vi.fn();
const searchWikipediaPages = vi.fn().mockResolvedValue([] as string[]);
const checkWikipediaPageExists = vi.fn().mockResolvedValue({ exists: false });

vi.mock("../entity-hint-lookup", () => ({
  lookupEntityHintWikipedia: (...args: unknown[]) => lookupEntityHintWikipedia(...args),
}));

vi.mock("../mediawiki-search", () => ({
  searchWikipediaPages: (...args: unknown[]) => searchWikipediaPages(...args),
  checkWikipediaPageExists: (...args: unknown[]) => checkWikipediaPageExists(...args),
}));

describe("enrichSapRowsWithWikipediaLookups", () => {
  beforeEach(() => {
    lookupEntityHintWikipedia.mockReset();
    searchWikipediaPages.mockReset();
    searchWikipediaPages.mockResolvedValue([]);
    checkWikipediaPageExists.mockReset();
    checkWikipediaPageExists.mockResolvedValue({ exists: false });
  });

  it("sets wikipedia_url and wikipedia_title on exact match", async () => {
    lookupEntityHintWikipedia.mockResolvedValue({
      kind: "exact",
      title: "Edmonton",
      url: "https://en.wikipedia.org/wiki/Edmonton",
    });
    const { enrichSapRowsWithWikipediaLookups } = await import("../enrich-sap-rows-with-wikipedia");
    const rows: CSVRow[] = [
      {
        keyword: "solar",
        entity: "Metro Core, Edmonton, AB",
        title: "Solar in Metro Core",
      },
    ];
    const out = await enrichSapRowsWithWikipediaLookups(rows, { siteId: "s1" });
    expect(lookupEntityHintWikipedia).toHaveBeenCalledWith("Metro Core, Edmonton, AB", { siteId: "s1" });
    expect(out[0]).toMatchObject({
      keyword: "solar",
      entity: "Metro Core, Edmonton, AB",
      wikipedia_url: "https://en.wikipedia.org/wiki/Edmonton",
      wikipedia_title: "Edmonton",
    });
  });

  it("batched enrichment resolves each row with one lookup per row", async () => {
    lookupEntityHintWikipedia.mockResolvedValue({
      kind: "exact",
      title: "Edmonton",
      url: "https://en.wikipedia.org/wiki/Edmonton",
    });
    const { enrichSapRowsWithWikipediaLookupsInBatches } = await import("../enrich-sap-rows-with-wikipedia");
    const rows: CSVRow[] = [
      { keyword: "k0", entity: "Place A, Edmonton, AB", title: "t0" },
      { keyword: "k1", entity: "Place B, Edmonton, AB", title: "t1" },
      { keyword: "k2", entity: "Place C, Edmonton, AB", title: "t2" },
    ];
    const out = await enrichSapRowsWithWikipediaLookupsInBatches(rows, { siteId: "s1" }, 2);
    expect(out).toHaveLength(3);
    expect(lookupEntityHintWikipedia).toHaveBeenCalledTimes(3);
    expect(out.every((r) => r.wikipedia_url?.includes("wikipedia.org"))).toBe(true);
  });

  it("keeps row when lookup returns none", async () => {
    lookupEntityHintWikipedia.mockResolvedValue({
      kind: "none",
      searchedQuery: "Foo Bar",
    });
    const { enrichSapRowsWithWikipediaLookups } = await import("../enrich-sap-rows-with-wikipedia");
    const rows: CSVRow[] = [{ keyword: "a", entity: "Foo Bar", title: "t" }];
    const out = await enrichSapRowsWithWikipediaLookups(rows);
    expect(out[0]).toEqual(rows[0]);
  });

  it("skips lookup when entity is blank", async () => {
    const { enrichSapRowsWithWikipediaLookups } = await import("../enrich-sap-rows-with-wikipedia");
    const rows: CSVRow[] = [{ keyword: "a", entity: "  ", title: "t" }];
    const out = await enrichSapRowsWithWikipediaLookups(rows);
    expect(lookupEntityHintWikipedia).not.toHaveBeenCalled();
    expect(out[0]).toEqual(rows[0]);
  });

  it("keeps row when lookup throws", async () => {
    lookupEntityHintWikipedia.mockRejectedValue(new Error("network"));
    const { enrichSapRowsWithWikipediaLookups } = await import("../enrich-sap-rows-with-wikipedia");
    const rows: CSVRow[] = [{ keyword: "a", entity: "Place, City, AB", title: "t" }];
    const out = await enrichSapRowsWithWikipediaLookups(rows);
    expect(out[0]).toEqual(rows[0]);
  });
});
