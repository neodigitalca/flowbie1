import { describe, expect, it } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import { wordpressSiteDisplayName } from "@/lib/wordpress-site-display-name";

function site(partial: Partial<WordPressSite> & Pick<WordPressSite, "id" | "name">): WordPressSite {
  return {
    siteUrl: "https://example.com",
    username: "u",
    appPassword: "p",
    enabled: true,
    ...partial,
  } as WordPressSite;
}

describe("wordpressSiteDisplayName", () => {
  it("prefers napInfo when stored name has trailing truncation ellipsis", () => {
    const s = site({
      id: "1",
      name: "Blind Magic Window Coverings | Hunter Douglas Blinds ...",
      napInfo: {
        name: "Blind Magic Window Coverings | Hunter Douglas Blinds & Shades",
        address: "",
        phone: "",
        locations: [],
      },
    });
    expect(wordpressSiteDisplayName(s)).toBe(
      "Blind Magic Window Coverings | Hunter Douglas Blinds & Shades",
    );
  });

  it("strips trailing truncation ellipsis when napInfo is missing", () => {
    const s = site({
      id: "3",
      name: "Tailored Interiors | Window Shades, Drapery | Interior ...",
    });
    expect(wordpressSiteDisplayName(s)).toBe(
      "Tailored Interiors | Window Shades, Drapery | Interior",
    );
  });

  it("keeps intentional mid-name ellipses", () => {
    const s = site({ id: "2", name: "You Junk It... I Dump It" });
    expect(wordpressSiteDisplayName(s)).toBe("You Junk It... I Dump It");
  });
});
