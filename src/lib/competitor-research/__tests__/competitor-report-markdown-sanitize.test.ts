import { describe, expect, it } from "vitest";
import {
  deriveShortLabelFromUrl,
  prettifyMarkdownLinkLabels,
  sanitizeStrategistMarkdownSection,
  stripDuplicatePageFragmentFromLabel,
  stripDefectivePipeTableRows,
  stripHtmlDecorations,
} from "@/lib/competitor-research/competitor-report-markdown-sanitize";

describe("sanitizeStrategistMarkdownSection", () => {
  it("collapses pathological hyphen runs in pipe-table separator cells", () => {
    const long = ":" + "-".repeat(5000);
    const line = `| ${long} | --- | --- |`;
    const out = sanitizeStrategistMarkdownSection(line);
    expect(out).toBe("| :--- | --- | --- |");
    expect(out.length).toBeLessThan(100);
  });

  it("collapses dash-only lines used as fake table rules", () => {
    const line = "-".repeat(3000);
    const out = sanitizeStrategistMarkdownSection(`Intro\n${line}\nMore`);
    expect(out).toContain("---");
    expect(out.split("\n")[1]).toBe("---");
  });

  it("does not alter normal pipe tables", () => {
    const md = [
      "| Scenario | Visits | Why |",
      "| --- | --- | --- |",
      "| Moderate | 1–5k | ok |",
    ].join("\n");
    expect(sanitizeStrategistMarkdownSection(md)).toBe(md);
  });

  it("preserves prose lines with hyphens", () => {
    const md = "Estimated lift is 10–20% in Q1 (see matrix).";
    expect(sanitizeStrategistMarkdownSection(md)).toBe(md);
  });

  it("replaces Unicode em dash (U+2014) with ASCII hyphen form", () => {
    expect(sanitizeStrategistMarkdownSection("Performance - up 10%.")).toBe("Performance - up 10%.");
    expect(sanitizeStrategistMarkdownSection("A - B")).toBe("A - B");
  });

  it("unwraps markdown links to CMS duplicate slugs (-2…-30) to plain label text", () => {
    const href = "https://example.com/temporary-modular-pre-fab-structures-ontario-2/";
    const md = `Pages like [Ontario](${href}) drive traffic.`;
    const out = sanitizeStrategistMarkdownSection(md);
    expect(out).toBe("Pages like Ontario drive traffic.");
    expect(out).not.toContain("ontario-2");
  });

  it("strips -2…-30 duplicate suffix from hyphenated slug tokens in prose", () => {
    const md =
      "Temporary modular: structures-austin-texas-united-states-2 and structures-ontario-2 show demand.";
    const out = sanitizeStrategistMarkdownSection(md);
    expect(out).toContain("structures-austin-texas-united-states");
    expect(out).toContain("structures-ontario");
    expect(out).not.toMatch(/united-states-2/);
    expect(out).not.toMatch(/structures-ontario-2/);
  });

  it("shortens path-like markdown link text in table cells", () => {
    const href = "https://ejhdistribution.com/products/tubbo/tubbo-glamping/";
    const ugly = `[ejhdistribution.com/products/tubbo/tubbo-glamping/](${href})`;
    const out = prettifyMarkdownLinkLabels(`| Page | Clicks |\n| --- | --- |\n| ${ugly} | 2 |`);
    expect(out).toContain(`[Tubbo Glamping](${href})`);
    expect(out).not.toMatch(/\[ejhdistribution\.com\/[^\]]{10,}\]/);
  });

  it("leaves short human link labels unchanged", () => {
    const md = "[Homepage](https://example.com/) and [SAP - Edmonton](https://example.com/edmonton)";
    expect(prettifyMarkdownLinkLabels(md)).toBe(md);
  });

  it("deriveShortLabelFromUrl returns null for invalid URL", () => {
    expect(deriveShortLabelFromUrl("not-a-url")).toBeNull();
  });

  it("stripHtmlDecorations converts styled span and anchor to plain markdown", () => {
    const raw =
      'See <span style="color:#22c55e">[Temp](https://ejh.com/a)</span> or <a href="https://ejh.com/b">Baltimore</a>.';
    expect(stripHtmlDecorations(raw)).toBe("See [Temp](https://ejh.com/a) or [Baltimore](https://ejh.com/b).");
  });

  it("stripHtmlDecorations removes bold wrapper around markdown links", () => {
    expect(stripHtmlDecorations("**[Label](https://example.com/x)**")).toBe("[Label](https://example.com/x)");
    expect(stripHtmlDecorations("** [Label](https://example.com/x) **")).toBe("[Label](https://example.com/x)");
  });

  it("stripDefectivePipeTableRows drops Not Available and sparse metric rows", () => {
    const md = [
      "| Page | Impressions | Clicks |",
      "| --- | --- | --- |",
      "| [Good](https://a.com/x) | 100 | 5 |",
      "| [Bad](https://a.com/y) | Not Available | Not Available |",
      "| [Sparse](https://a.com/z) |  |  |",
    ].join("\n");
    const out = stripDefectivePipeTableRows(md);
    expect(out).toContain("[Good]");
    expect(out).not.toContain("[Bad]");
    expect(out).not.toContain("[Sparse]");
    expect(out).toContain("| --- | --- | --- |");
  });

  it("stripDuplicatePageFragmentFromLabel removes trailing copy suffix when URL slug ends with -2", () => {
    const href = "https://ejh.com/service-area/temporary-modular-pre-fab-structures-ontario-2/";
    expect(stripDuplicatePageFragmentFromLabel("Temporary Modular Pre Fab Structures Ontario 2", href)).toBe(
      "Temporary Modular Pre Fab Structures Ontario",
    );
  });

  it("stripDefectivePipeTableRows drops rows whose link URL is a CMS duplicate slug (-2)", () => {
    const md = [
      "| Page | Clicks |",
      "| --- | --- |",
      "| [Canonical](https://ejh.com/area/ontario/) | 10 |",
      "| [Dup](https://ejh.com/area/ontario-2/) | 1 |",
    ].join("\n");
    const out = stripDefectivePipeTableRows(md);
    expect(out).toContain("Canonical");
    expect(out).not.toContain("ontario-2");
  });

  it("prettifyMarkdownLinkLabels strips duplicate suffix from AI label when URL has -2", () => {
    const href = "https://ejh.com/area/foo-2/";
    const md = `[Foo 2](${href})`;
    expect(prettifyMarkdownLinkLabels(md)).toBe(`[Foo](${href})`);
  });
});
