import { describe, expect, it } from "vitest";
import { buildOverviewLinkRulesBlock } from "@/lib/prompt-builders/overview-link-rules";

const ENTITY = "Canora, Edmonton, AB";
const WIKI = "https://en.wikipedia.org/wiki/Canora%2C_Edmonton";

describe("buildOverviewLinkRulesBlock", () => {
  it("bans Wikipedia when no entity wiki URL", () => {
    const block = buildOverviewLinkRulesBlock();
    expect(block).toContain("FORBIDDEN");
    expect(block).toContain("Wikipedia");
    expect(block).not.toContain("ENTITY WIKIPEDIA (REQUIRED)");
  });

  it("allows exact entity Wikipedia when entity and URL present", () => {
    const block = buildOverviewLinkRulesBlock({ entity: ENTITY, wikipediaUrl: WIKI });
    expect(block).toContain("ENTITY WIKIPEDIA (REQUIRED)");
    expect(block).toContain(WIKI);
    expect(block).toContain(ENTITY);
    expect(block).toContain("# citations");
    expect(block).not.toMatch(/FORBIDDEN: http\/https URLs, site page paths, Wikipedia/);
  });

  it("stays hash-only when entity missing", () => {
    const block = buildOverviewLinkRulesBlock({ wikipediaUrl: WIKI });
    expect(block).not.toContain("ENTITY WIKIPEDIA (REQUIRED)");
    expect(block).toMatch(/FORBIDDEN:.*Wikipedia/);
  });
});
