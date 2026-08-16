import { describe, expect, it } from "vitest";
import {
  buildContentCalendarExportCsv,
  CONTENT_CALENDAR_HEADERS,
  parseContentCalendarCsv,
} from "@/lib/social/content-calendar-csv";

const NEO_CALENDAR_CSV = `Events,Keyword,Day Of week,Dates,FB/Instagram Content,Linkedin Content,Link/Landing page,Image,Prompt Modifier
,AISEO Edmonton,Tuesday,8/11/2026,Book your free audit,LinkedIn draft,https://neodigital.ca/contact/,,
,elementor help,Wednesday,8/12/2026,,,https://neodigital.ca/contact/,,
,website design,Thursday,8/13/2026,,,https://neodigital.ca/contact/,,Show product UI close-up`;

describe("parseContentCalendarCsv", () => {
  it("parses Neo Digital content calendar sheet", () => {
    const rows = parseContentCalendarCsv(NEO_CALENDAR_CSV);
    expect(rows).toHaveLength(3);
    expect(rows[0]?.keyword).toBe("AISEO Edmonton");
    expect(rows[0]?.fbInstagramContent).toBe("Book your free audit");
    expect(rows[0]?.linkedinContent).toBe("LinkedIn draft");
    expect(rows[0]?.landingPageUrl).toBe("https://neodigital.ca/contact/");
  });

  it("ignores legacy Blog Title column when present", () => {
    const legacyCsv = `Events,Keyword,Day Of week,Dates,Blog Title,FB/Instagram Content,Linkedin Content,Link/Landing page,Image,Prompt Modifier
,AISEO Edmonton,Tuesday,8/11/2026,Example Blog Title,Book your free audit,LinkedIn draft,https://neodigital.ca/contact/,,
`;
    const rows = parseContentCalendarCsv(legacyCsv);
    expect(rows[0]?.keyword).toBe("AISEO Edmonton");
    expect(rows[0]?.fbInstagramContent).toBe("Book your free audit");
  });

  it("maps Prompt Modifier column", () => {
    const rows = parseContentCalendarCsv(NEO_CALENDAR_CSV);
    const row = rows.find((r) => r.keyword === "website design");
    expect(row?.promptModifier).toBe("Show product UI close-up");
  });

  it("coerces numeric CSV date cells", () => {
    const rows = parseContentCalendarCsv("Keyword,Dates\nedmonton seo,45123\n");
    expect(rows[0]?.keyword).toBe("edmonton seo");
    expect(rows[0]?.date).toBe("45123");
  });
});

describe("buildContentCalendarExportCsv", () => {
  it("round-trips Neo Digital headers without Blog Title", () => {
    const csv = buildContentCalendarExportCsv([
      {
        id: "1",
        status: "ready",
        keyword: "AISEO Edmonton",
        fbInstagramContent: "Book your free audit",
        linkedinContent: "LinkedIn draft",
        landingPageUrl: "https://neodigital.ca/contact/",
      },
    ]);
    expect(csv).toContain(CONTENT_CALENDAR_HEADERS.join(","));
    expect(csv).not.toContain("Blog Title");
    expect(csv).toContain("AISEO Edmonton");
    expect(csv).toContain("LinkedIn draft");
  });
});
