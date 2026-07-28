import { describe, expect, it } from "vitest";
import { parseBlogIdeasChecklist } from "../bulk/bulk-csv-parser";

const CANON =
  '1. Keyword: "web scraping", Entity: "Acme", Title: "Web Scraping vs APIs", MetaDescription: "Compare scraping and APIs for data collection. Pick the right approach.", Modifier: "versus", FeaturedImage: "y"';

describe("parseBlogIdeasChecklist", () => {
  it("parses canonical line", () => {
    const rows = parseBlogIdeasChecklist(CANON);
    expect(rows).toHaveLength(1);
    expect(rows[0].keyword).toBe("web scraping");
    expect(rows[0].title).toBe("Web Scraping vs APIs");
  });

  it("parses indented numbered line", () => {
    const raw = `Some intro\n   ${CANON}`;
    const rows = parseBlogIdeasChecklist(raw);
    expect(rows).toHaveLength(1);
    expect(rows[0].keyword).toBe("web scraping");
  });

  it("parses markdown bullet before number", () => {
    const raw = `- ${CANON}`;
    const rows = parseBlogIdeasChecklist(raw);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Web Scraping vs APIs");
  });

  it("parses bold markdown numbering", () => {
    const raw = CANON.replace(/^1\.\s/, "**1.** ");
    const rows = parseBlogIdeasChecklist(raw);
    expect(rows).toHaveLength(1);
    expect(rows[0].keyword).toBe("web scraping");
  });

  it("strips outer fenced block", () => {
    const raw = "```markdown\n" + CANON + "\n```";
    const rows = parseBlogIdeasChecklist(raw);
    expect(rows).toHaveLength(1);
    expect(rows[0].keyword).toBe("web scraping");
  });

  it("parses empty Modifier for entity landing rows", () => {
    const line =
      '1. Keyword: "blinds edmonton", Entity: "Edmonton AB", Title: "Blinds in Edmonton", MetaDescription: "Professional blinds in Edmonton. Request a consult.", Modifier: "", FeaturedImage: "google-maps"';
    const rows = parseBlogIdeasChecklist(line);
    expect(rows).toHaveLength(1);
    expect(rows[0].modifier).toBe("");
    expect(rows[0].featuredImage).toBe("google-maps");
  });

  it("parses bold markdown field labels", () => {
    const line =
      '1. **Keyword:** "web scraping", **Entity:** "Acme", **Title:** "Web Scraping vs APIs", **MetaDescription:** "Compare scraping and APIs.", **Modifier:** "versus", **FeaturedImage:** "y"';
    const rows = parseBlogIdeasChecklist(line);
    expect(rows).toHaveLength(1);
    expect(rows[0].keyword).toBe("web scraping");
    expect(rows[0].title).toBe("Web Scraping vs APIs");
  });

  it("parses curly double quotes around values", () => {
    const line =
      '1. Keyword: \u201cweb scraping\u201d, Entity: \u201cAcme\u201d, Title: \u201cWeb Scraping vs APIs\u201d, MetaDescription: \u201cCompare scraping and APIs.\u201d, Modifier: \u201cversus\u201d, FeaturedImage: \u201cy\u201d';
    const rows = parseBlogIdeasChecklist(line);
    expect(rows).toHaveLength(1);
    expect(rows[0].keyword).toBe("web scraping");
  });

  it("parses checklist when outer markdown fence is never closed", () => {
    const raw = "```text\n" + CANON + "\n(no closing fence)";
    const rows = parseBlogIdeasChecklist(raw);
    expect(rows).toHaveLength(1);
    expect(rows[0].keyword).toBe("web scraping");
  });

  it("parses multi-line fields per numbered item", () => {
    const raw = `1. Keyword: "blinds vs shades"
Title: "Blinds Versus Shades: Which Window Covering Wins?"
MetaDescription: "Blinds versus shades: a detailed comparison."
Modifier: "versus"
FeaturedImage: "y"

2. Keyword: "cellular shades cost"
Title: "Cellular Shades Cost Guide"
MetaDescription: "Understand cellular shades cost factors."
Modifier: "cost guide"
FeaturedImage: "y"`;
    const rows = parseBlogIdeasChecklist(raw);
    expect(rows).toHaveLength(2);
    expect(rows[0].keyword).toBe("blinds vs shades");
    expect(rows[0].title).toBe("Blinds Versus Shades: Which Window Covering Wins?");
    expect(rows[0].modifier).toBe("versus");
    expect(rows[1].keyword).toBe("cellular shades cost");
  });

  it("drops Bali Blinds rows from checklist output", () => {
    const raw = `${CANON}
2. Keyword: "bali blinds removal", Entity: "", Title: "Bali Blinds Removal Simplified And Safe", MetaDescription: "How to remove Bali blinds safely.", Modifier: "how-to", FeaturedImage: "y"`;
    const rows = parseBlogIdeasChecklist(raw);
    expect(rows).toHaveLength(1);
    expect(rows[0].keyword).toBe("web scraping");
  });

  it("drops connected-site company brand keywords", () => {
    const raw = `${CANON}
2. Keyword: "blind magic", Entity: "", Title: "Blind Magic Window Coverings Experts", MetaDescription: "Meet Blind Magic experts for window coverings.", Modifier: "guide", FeaturedImage: "y"`;
    const rows = parseBlogIdeasChecklist(
      raw,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      "Blind Magic Window Coverings | Hunter Douglas Blinds",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].keyword).toBe("web scraping");
  });
});
