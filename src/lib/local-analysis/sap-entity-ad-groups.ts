import type { CSVRow } from "@/lib/bulk/bulk-csv-parser";
import { normalizeEntityHintCommaLabel } from "@/lib/comma-place-label";

export type EntityAdGroupSection = {
  entity: string;
  groupId: string;
  rowIndices: number[];
};

export function entityAdGroupKey(entity: string): string {
  return entity.trim().replace(/\s+/g, " ").toLowerCase();
}

/** MapPin header label: parent city/area when set, else row entity. */
export function entityAdGroupHeaderLabel(row: CSVRow): string {
  const parent = normalizeEntityHintCommaLabel((row.ad_group_label ?? "").trim());
  const entity = normalizeEntityHintCommaLabel((row.entity ?? "").trim());
  return parent || entity;
}

/** Ad-group sections in first-seen header order. Rows without an entity are omitted (never "Unknown location"). */
export function buildEntityAdGroupSections(rows: CSVRow[]): EntityAdGroupSection[] {
  const sections: EntityAdGroupSection[] = [];
  const byKey = new Map<string, EntityAdGroupSection>();
  for (let i = 0; i < rows.length; i++) {
    const entity = normalizeEntityHintCommaLabel((rows[i]?.entity ?? "").trim());
    if (!entity) continue;
    const header = entityAdGroupHeaderLabel(rows[i]!);
    const key = entityAdGroupKey(header);
    let section = byKey.get(key);
    if (!section) {
      section = { entity: header, groupId: key, rowIndices: [] };
      byKey.set(key, section);
      sections.push(section);
    }
    section.rowIndices.push(i);
  }
  return sections;
}

/** Reorder SAP rows so every entity ad group is contiguous (ad-group export order). */
export function sortSapRowsByEntityAdGroups(rows: CSVRow[]): CSVRow[] {
  const sections = buildEntityAdGroupSections(rows);
  return sections.flatMap((section) => section.rowIndices.map((i) => rows[i]!));
}

/** Keyword column label inside an entity ad group (strip trailing entity from focus keyword). */
export function sapBaseKeywordDisplay(row: CSVRow): string {
  const entity = (row.entity ?? "").trim();
  const keyword = (row.keyword ?? "").trim();
  if (!entity || !keyword) return keyword;
  const lowerKw = keyword.toLowerCase();
  const lowerEntity = entity.toLowerCase();
  if (lowerKw.endsWith(lowerEntity)) {
    return keyword.slice(0, keyword.length - entity.length).replace(/[\s,]+$/, "").trim() || keyword;
  }
  return keyword;
}

/** Stamp entity ad group ids on rows (first row per entity = seed). */
export function stampEntityAdGroupRoles(rows: CSVRow[]): CSVRow[] {
  const sections = buildEntityAdGroupSections(rows);
  const roleByIndex = new Map<number, "seed" | "member">();
  const groupIdByIndex = new Map<number, string>();
  for (const section of sections) {
    section.rowIndices.forEach((idx, j) => {
      groupIdByIndex.set(idx, section.groupId);
      roleByIndex.set(idx, j === 0 ? "seed" : "member");
    });
  }
  return rows.map((row, i) => ({
    ...row,
    entity_group_id: groupIdByIndex.get(i),
    entity_group_role: roleByIndex.get(i),
  }));
}

export function finalizeEntitySapRowsForAdGroups(rows: CSVRow[]): CSVRow[] {
  return stampEntityAdGroupRoles(sortSapRowsByEntityAdGroups(rows));
}
