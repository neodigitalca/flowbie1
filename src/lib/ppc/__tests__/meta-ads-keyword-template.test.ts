import { describe, expect, it } from "vitest";
import {
  buildCalendarImagePromptModifier,
  parseMetaKeywordTemplateCsv,
} from "@/lib/ppc/meta-ads-keyword-template";

const CALENDAR_CSV = `Keyword,Day Of week,Dates,FB/Linkedin Content,Link/Landing page
AISEO Edmonton,Tuesday,8/11/2026,,
elementor help,Wednesday,8/12/2026,,
website design,Thursday,8/13/2026,,
digital presence,Friday,8/14/2026,,https://neodigital.ca/blog/edmonton-seo-expert/
Free SEO Audit Edmonton,Saturday,8/15/2026,,https://neodigital.ca/blog/free-seo-audit/`;

const NEO_CALENDAR_CSV = `Events,Keyword,Day Of week,Dates,FB/Instagram Content,Linkedin Content,Link/Landing page,Image,Prompt Modifier
,AISEO Edmonton,Tuesday,8/11/2026,Book your free audit,LinkedIn draft,https://neodigital.ca/contact/,,
,elementor help,Wednesday,8/12/2026,,,https://neodigital.ca/contact/,,
,website design,Thursday,8/13/2026,,,https://neodigital.ca/contact/,,Show product UI close-up`;

describe("parseMetaKeywordTemplateCsv", () => {
  it("parses keyword header", () => {
    const rows = parseMetaKeywordTemplateCsv("keyword\nwindow coverings\nblinds Edmonton\n");
    expect(rows).toEqual([
      { focusKeyword: "window coverings" },
      { focusKeyword: "blinds Edmonton" },
    ]);
  });

  it("parses focus_keyword alias", () => {
    const rows = parseMetaKeywordTemplateCsv("focus_keyword\nSEO agency\nlocal SEO\n");
    expect(rows.map((row) => row.focusKeyword)).toEqual(["SEO agency", "local SEO"]);
  });

  it("ignores empty rows", () => {
    const rows = parseMetaKeywordTemplateCsv("keyword\nvalid\n\n  \n");
    expect(rows).toEqual([{ focusKeyword: "valid" }]);
  });

  it("parses Neo Digital content calendar sheet", () => {
    const rows = parseMetaKeywordTemplateCsv(CALENDAR_CSV);
    expect(rows).toHaveLength(5);
    expect(rows[0]?.focusKeyword).toBe("AISEO Edmonton");
    expect(rows[0]?.landingPageUrl).toBeUndefined();
    expect(rows[0]?.imagePromptModifier).toBe("Topic: AISEO Edmonton");
  });

  it("maps link to landingPageUrl and contextUrl", () => {
    const rows = parseMetaKeywordTemplateCsv(CALENDAR_CSV);
    const withLink = rows.find((row) => row.focusKeyword === "Free SEO Audit Edmonton");
    expect(withLink?.landingPageUrl).toBe("https://neodigital.ca/blog/free-seo-audit/");
    expect(withLink?.contextUrl).toBe("https://neodigital.ca/blog/free-seo-audit/");
    expect(withLink?.contextSource).toBe("custom");
    expect(withLink?.imagePromptModifier).toBe(
      "Topic: Free SEO Audit Edmonton. Blog context URL: https://neodigital.ca/blog/free-seo-audit/",
    );
  });

  it("omits landingPageUrl when link column is empty", () => {
    const rows = parseMetaKeywordTemplateCsv(CALENDAR_CSV);
    const noLink = rows.find((row) => row.focusKeyword === "elementor help");
    expect(noLink?.landingPageUrl).toBeUndefined();
  });

  it("maps Prompt Modifier column directly to imagePromptModifier", () => {
    const rows = parseMetaKeywordTemplateCsv(NEO_CALENDAR_CSV);
    const withModifier = rows.find((row) => row.focusKeyword === "website design");
    expect(withModifier?.imagePromptModifier).toBe("Show product UI close-up");
    expect(withModifier?.imagePromptModifier).not.toContain("Topic:");
  });

  it("does not synthesize visual note when Prompt Modifier column exists but cell is empty", () => {
    const rows = parseMetaKeywordTemplateCsv(NEO_CALENDAR_CSV);
    const row = rows.find((r) => r.focusKeyword === "AISEO Edmonton");
    expect(row?.imagePromptModifier).toBeUndefined();
  });

  it("maps FB/Instagram Content to fbInstagramContent", () => {
    const rows = parseMetaKeywordTemplateCsv(NEO_CALENDAR_CSV);
    const row = rows.find((r) => r.focusKeyword === "AISEO Edmonton");
    expect(row?.fbInstagramContent).toBe("Book your free audit");
  });
});

describe("buildCalendarImagePromptModifier", () => {
  it("includes social copy when present", () => {
    const modifier = buildCalendarImagePromptModifier({
      focusKeyword: "AISEO Edmonton",
      landingPageUrl: "https://example.com/post",
      socialCopy: "Book a demo today",
    });
    expect(modifier).toContain("Topic: AISEO Edmonton");
    expect(modifier).toContain("Blog context URL: https://example.com/post");
    expect(modifier).toContain("Social angle: Book a demo today");
  });
});
