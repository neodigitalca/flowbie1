import { describe, expect, it } from "vitest";
import {
  inferKeywordFromTitle,
  parseImportedBlogHtml,
  parseImportedBlogMarkdown,
  importedDraftToCsvRow,
  validateImportedBlogDraft,
  findImportedSectionBody,
  SECTION_BODY_MAX_CHARS,
} from "../blog-import-parser";
import { parseImportedSectionsJson } from "../bulk-csv-parser";

const SAMPLE_HTML = `
<h1>Canada Arctic Investment Guide</h1>
<p>Intro paragraph.</p>
<h2>Why the $35B program matters</h2>
<p>First section body with facts about northern infrastructure.</p>
<h2>Regional economic impact</h2>
<p>Second section discusses territories and mining.</p>
`;

describe("parseImportedBlogHtml", () => {
  it("extracts every h1 and h2 heading in order with full bodies", () => {
    const draft = parseImportedBlogHtml(SAMPLE_HTML, "test.docx");
    expect(draft.title).toBe("Canada Arctic Investment Guide");
    expect(draft.preambleHtml).toContain("<h1>Canada Arctic Investment Guide</h1>");
    expect(draft.preambleHtml).toContain("Intro paragraph");
    expect(draft.sections).toHaveLength(3);
    expect(draft.sections[0].h2).toBe("Canada Arctic Investment Guide");
    expect(draft.sections[0].body).toContain("Intro paragraph");
    expect(draft.sections[1].h2).toBe("Why the $35B program matters");
    expect(draft.sections[1].body).toContain("northern infrastructure");
    expect(draft.sections[2].h2).toBe("Regional economic impact");
  });

  it("respects title override", () => {
    const draft = parseImportedBlogHtml(SAMPLE_HTML, "x.docx", "Custom Title");
    expect(draft.title).toBe("Custom Title");
  });
});

describe("parseImportedBlogMarkdown", () => {
  it("parses # and ## headings in order", () => {
    const md = `# Main Title\n\nIntro line.\n\n## Section A\n\nBody A text.\n\n## Section B\n\nBody B text.`;
    const draft = parseImportedBlogMarkdown(md, "post.md");
    expect(draft.title).toBe("Main Title");
    expect(draft.sections).toHaveLength(3);
    expect(draft.sections[0].h2).toBe("Main Title");
    expect(draft.sections[0].body).toContain("Intro line");
    expect(draft.sections[1].h2).toBe("Section A");
    expect(draft.sections[2].body).toContain("Body B");
  });
});

describe("validateImportedBlogDraft", () => {
  it("requires at least two H2 sections", () => {
    expect(() =>
      validateImportedBlogDraft({
        title: "T",
        sections: [{ h2: "Only one", body: "" }],
      }),
    ).toThrow(/at least 2 H2/i);
  });
});

describe("inferKeywordFromTitle", () => {
  it("returns 2–4 significant words", () => {
    const kw = inferKeywordFromTitle("Canada's $35 Billion Arctic Investment");
    expect(kw.split(" ").length).toBeGreaterThanOrEqual(2);
    expect(kw).toMatch(/canada|arctic|investment|billion/i);
  });
});

describe("importedDraftToCsvRow", () => {
  it("maps to CSVRow with imported_sections_json and preamble", () => {
    const draft = parseImportedBlogHtml(SAMPLE_HTML, "test.docx");
    const row = importedDraftToCsvRow(draft, "arctic investment");
    expect(row.keyword).toBe("arctic investment");
    expect(row.imported_sections_json).toBeTruthy();
    expect(row.imported_preamble_html).toContain("<h1>");
    const parsed = parseImportedSectionsJson(row.imported_sections_json);
    expect(parsed).toHaveLength(3);
    expect(row.prompt_modifier).toContain("SOURCE DRAFT");
    expect(row.featuredImage).toBe("y");
  });

  it("sets featuredImage to n when option passed", () => {
    const draft = parseImportedBlogHtml(SAMPLE_HTML, "test.docx");
    const row = importedDraftToCsvRow(draft, undefined, { featuredImage: "n" });
    expect(row.featuredImage).toBe("n");
  });

  it("sets featuredImage to google-maps and entity when option passed", () => {
    const draft = parseImportedBlogHtml(SAMPLE_HTML, "test.docx");
    const row = importedDraftToCsvRow(draft, undefined, {
      featuredImage: "google-maps",
      entity: "Edmonton AB",
    });
    expect(row.featuredImage).toBe("google-maps");
    expect(row.entity).toBe("Edmonton AB");
  });
});

describe("findImportedSectionBody", () => {
  it("finds body by section title", () => {
    const draft = parseImportedBlogHtml(SAMPLE_HTML, "test.docx");
    const row = importedDraftToCsvRow(draft);
    const body = findImportedSectionBody(row, "Regional economic impact");
    expect(body).toContain("territories");
  });
});

describe("section body truncation", () => {
  it("keeps full bodies for imported sections", () => {
    const longBody = "word ".repeat(500);
    const html = `<h1>T</h1><h2>A</h2><p>${longBody}</p><h2>B</h2><p>short</p>`;
    const draft = parseImportedBlogHtml(html, "t.docx");
    expect(draft.sections[1].body.length).toBeGreaterThan(SECTION_BODY_MAX_CHARS);
    expect(draft.sections[1].body).not.toMatch(/…$/);
  });
});
