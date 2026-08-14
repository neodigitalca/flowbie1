import { describe, expect, it } from "vitest";
import {
  formatTypographyStyleForPrompt,
  META_TYPOGRAPHY_STYLE_DEFAULT,
  resolveMetaTypographyStyle,
} from "@/lib/ppc/meta-ad-typography-styles";

describe("meta-ad-typography-styles", () => {
  it("defaults to inter", () => {
    expect(resolveMetaTypographyStyle(undefined)).toBe(META_TYPOGRAPHY_STYLE_DEFAULT);
    expect(resolveMetaTypographyStyle("invalid")).toBe("inter");
  });

  it("formats prompt line for known style", () => {
    expect(formatTypographyStyleForPrompt("montserrat")).toContain("Montserrat Google Font");
  });
});
