/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { parseNeoPulseFieldsExportJson } from "../neo-pulse-fields-discovery.cjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("parseNeoPulseFieldsExportJson", () => {
  it("parses ACF-compatible export fixture into field definitions", () => {
    const fixturePath = join(
      process.cwd(),
      "wordpress-plugins/neo-pulse-wp/includes/fields/fixtures/acf-export-starter.json",
    );
    const json = readFileSync(fixturePath, "utf8");
    const parsed = parseNeoPulseFieldsExportJson(json);
    expect(parsed).not.toBeNull();
    expect(parsed!.fields.length).toBeGreaterThan(0);
    const names = parsed!.fields.map((f) => f.name);
    expect(names).toContain("seo_extra_text");
    expect(names).toContain("seo_faq");
    const extra = parsed!.fields.find((f) => f.name === "seo_extra_text");
    expect(extra?.type).toBe("wysiwyg");
    expect(extra?.label).toBe("Extra Text");
  });

  it("returns null for invalid JSON", () => {
    expect(parseNeoPulseFieldsExportJson("not json")).toBeNull();
    expect(parseNeoPulseFieldsExportJson("[]")).toEqual({ fieldGroups: [], fields: [] });
  });
});
