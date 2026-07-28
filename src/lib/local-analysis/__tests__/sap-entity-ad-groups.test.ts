import { describe, expect, it } from "vitest";
import {
  buildEntityAdGroupSections,
  finalizeEntitySapRowsForAdGroups,
  sapBaseKeywordDisplay,
  sortSapRowsByEntityAdGroups,
} from "@/lib/local-analysis/sap-entity-ad-groups";
import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";

function row(entity: string, keyword: string): CSVRow {
  return { entity, keyword, title: "" };
}

describe("sortSapRowsByEntityAdGroups", () => {
  it("groups rows by entity in first-seen order", () => {
    const rows = [
      row("B, MB", "blinds B, MB"),
      row("A, MB", "shades A, MB"),
      row("B, MB", "drapes B, MB"),
      row("A, MB", "custom A, MB"),
    ];
    const sorted = sortSapRowsByEntityAdGroups(rows);
    expect(sorted.map((r) => r.entity)).toEqual(["B, MB", "B, MB", "A, MB", "A, MB"]);
  });
});

describe("buildEntityAdGroupSections", () => {
  it("returns ad group sections with row indices", () => {
    const rows = [row("Winkler, MB", "a Winkler, MB"), row("Winkler, MB", "b Winkler, MB")];
    const sections = buildEntityAdGroupSections(rows);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.entity).toBe("Winkler, MB");
    expect(sections[0]!.rowIndices).toEqual([0, 1]);
  });

  it("omits rows with no entity — never invents Unknown location", () => {
    const sections = buildEntityAdGroupSections([
      row("", "blinds edmonton"),
      row("Westmount, Edmonton, AB", "blinds"),
      { keyword: "x", title: "" },
    ]);
    expect(sections).toHaveLength(1);
    expect(sections[0]!.entity).toBe("Westmount, Edmonton, AB");
    expect(sections.every((s) => s.entity.toLowerCase() !== "unknown location")).toBe(true);
  });
});

describe("sapBaseKeywordDisplay", () => {
  it("strips trailing entity from keyword label", () => {
    expect(
      sapBaseKeywordDisplay({
        keyword: "alta roman shades Southland Mall, Winkler, MB",
        entity: "Southland Mall, Winkler, MB",
        title: "",
      }),
    ).toBe("alta roman shades");
  });
});

describe("finalizeEntitySapRowsForAdGroups", () => {
  it("sorts and stamps seed/member roles", () => {
    const out = finalizeEntitySapRowsForAdGroups([
      row("A, MB", "kw1 A, MB"),
      row("B, MB", "kw2 B, MB"),
      row("A, MB", "kw3 A, MB"),
    ]);
    expect(out[0]!.entity_group_role).toBe("seed");
    expect(out[1]!.entity_group_role).toBe("member");
    expect(out[2]!.entity_group_role).toBe("seed");
    expect(out[2]!.entity).toBe("B, MB");
  });
});
