import { describe, expect, it } from "vitest";
import {
  createDefaultMetaVisualToolPalette,
  resolveSocialVisualToolMode,
} from "@/lib/social/social-creator-generate-config-defaults";
import { createDefaultSocialGenerateConfig } from "@/lib/social/social-creator-field-limits";

describe("social-creator-generate-config-defaults", () => {
  it("lowers default icon_cluster degree for Social Creator", () => {
    const palette = createDefaultMetaVisualToolPalette();
    expect(palette.icon_cluster.degree).toBe(0.35);
  });

  it("defaults new config to fixed visual tool mode", () => {
    expect(createDefaultSocialGenerateConfig().defaultVisualToolMode).toBe("fixed");
  });

  it("defaults missing mode to fixed", () => {
    expect(resolveSocialVisualToolMode(undefined)).toBe("fixed");
  });
});
