import { describe, expect, it } from "vitest";
import {
  ARTICLE_MAX_WORDS,
  MAX_CHECKLIST_ITEMS_BLOG,
  MAX_CHECKLIST_ITEMS_SAP,
  buildArticleLengthChecklistBlock,
  buildBlueprintArticleLengthBlock,
  buildFocusedArticlePurpose,
  buildHarnessArticleBudgetBlock,
  buildHarnessArticleCapLine,
  perSectionWordBudget,
} from "@/lib/content-generation/article-length-policy";

describe("article-length-policy", () => {
  it("uses 2000 as article max", () => {
    expect(ARTICLE_MAX_WORDS).toBe(2000);
    expect(MAX_CHECKLIST_ITEMS_BLOG).toBe(6);
    expect(MAX_CHECKLIST_ITEMS_SAP).toBe(7);
  });

  it("computes per-section word budget", () => {
    expect(perSectionWordBudget(6)).toBe(333);
    expect(perSectionWordBudget(1)).toBe(2000);
  });

  it("checklist block differs for blog vs SAP", () => {
    const blog = buildArticleLengthChecklistBlock(false);
    const sap = buildArticleLengthChecklistBlock(true);
    expect(blog).toContain("2000");
    expect(blog).toContain("5-6");
    expect(sap).toContain("6-7");
    expect(sap).toContain(String(MAX_CHECKLIST_ITEMS_SAP));
  });

  it("blueprint block references article cap", () => {
    const block = buildBlueprintArticleLengthBlock();
    expect(block).toContain("2000");
    expect(block).toContain("focused guide");
    expect(block).toContain("One agent = one H2");
    expect(block).toContain("Never use \"comprehensive\"");
  });

  it("focused article purpose avoids comprehensive wording", () => {
    const purpose = buildFocusedArticlePurpose("dentist ebbers edmonton");
    expect(purpose).toContain("2000");
    expect(purpose).toContain("Focused guide");
    expect(purpose).not.toMatch(/comprehensive/i);
  });

  it("checklist block caps tables and duplicate topics", () => {
    const blog = buildArticleLengthChecklistBlock(false);
    expect(blog).toContain("at most 2");
    expect(blog).toContain("NO DUPLICATE TOPICS");
  });

  it("harness budget scales by section index", () => {
    const intro = buildHarnessArticleBudgetBlock(0, 6);
    const body = buildHarnessArticleBudgetBlock(2, 6);
    expect(intro).toContain("2000");
    expect(intro).toMatch(/~\d+ words/);
    expect(body).toContain("2000");
  });

  it("harness cap line summarizes full article budget", () => {
    const line = buildHarnessArticleCapLine(5);
    expect(line).toContain("2000");
    expect(line).toContain("5 section");
    expect(line).toContain(String(perSectionWordBudget(5)));
  });
});
