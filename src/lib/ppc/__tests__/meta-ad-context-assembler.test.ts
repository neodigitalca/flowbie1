import { describe, expect, it } from "vitest";
import {
  buildMetaUnifiedContextBlock,
  loadMetaFlowbieAppContextResearch,
  metaContextUrlsMatch,
} from "@/lib/ppc/meta-ad-context-assembler";
import { FLOWBIE_PRODUCT_URL } from "@/lib/ppc/flowbie-meta-marketing-context";

describe("meta-ad-context-assembler", () => {
  it("merges flowbie program brief with landing research", () => {
    const block = buildMetaUnifiedContextBlock({
      contextSource: "flowbie_app",
      landingResearch: {
        url: "https://neodigital.ca/contact",
        pageContext: "Landing page research block",
        title: "Contact Neo Digital",
        bodyText: "Contact us for digital presence",
        markdown: "Landing page research block",
      },
      focusKeyword: "digital presence",
      teamName: "Neo Digital Inc.",
    });

    expect(block).toContain("FlowbieONE program brief");
    expect(block).toContain("Program modules");
    expect(block).toContain("Landing page research");
    expect(block).toContain("digital presence");
    expect(block).not.toContain("codebase");
    expect(block).not.toContain("Agency voice");
  });

  it("loads flowbie app context from program brief without a URL", () => {
    const research = loadMetaFlowbieAppContextResearch();
    expect(research.url).toBe("");
    expect(research.pageContext).toContain("Program modules");
    expect(research.markdown).toContain("FlowbieONE program brief");
  });

  it("matches normalized URLs", () => {
    expect(metaContextUrlsMatch("https://flowbie.ca/flowbie/", FLOWBIE_PRODUCT_URL)).toBe(true);
    expect(metaContextUrlsMatch("https://neodigital.ca/contact", FLOWBIE_PRODUCT_URL)).toBe(false);
  });
});
