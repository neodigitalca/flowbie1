import { describe, expect, it } from "vitest";
import {
  buildMetaDeviceScreenLayoutBlock,
  parseMetaDeviceScreenLayout,
  resolveMetaDeviceScreenLayout,
} from "@/lib/ppc/meta-ad-device-screen-layout";
import type { MetaAdCreativeBrief } from "@/lib/ppc/meta-ads-types";
import { emptyVisualToolPalette } from "@/lib/ppc/meta-ad-visual-tool-palette";
import { DEVICE_PALETTE } from "@/lib/ppc/__tests__/meta-ad-test-fixtures";

const baseBrief = (overrides: Partial<MetaAdCreativeBrief> = {}): MetaAdCreativeBrief => ({
  strategyStatement: "Strategy",
  captionHook: "Hook",
  onImageHeadline: "Rank higher online",
  onImageSubline: "Get found locally",
  visualConcept: "Laptop with site mockup",
  visualVibe: "bold-minimal",
  backgroundTreatment: "Dark gradient",
  useMapOverlay: false,
  creativeStyle: "designed_graphic",
  visualToolPalette: emptyVisualToolPalette(),
  ...overrides,
});

describe("parseMetaDeviceScreenLayout", () => {
  it("parses known layouts and aliases", () => {
    expect(parseMetaDeviceScreenLayout("elementor_editor")).toBe("elementor_editor");
    expect(parseMetaDeviceScreenLayout("Elementor Editor")).toBe("elementor_editor");
    expect(parseMetaDeviceScreenLayout("unknown")).toBe("none");
  });
});

describe("resolveMetaDeviceScreenLayout", () => {
  it("uses brief deviceScreenLayout when set", () => {
    const layout = resolveMetaDeviceScreenLayout(
      baseBrief({ deviceScreenLayout: "wordpress_admin" }),
    );
    expect(layout).toBe("wordpress_admin");
  });

  it("resolves elementor from web design context", () => {
    const brief = baseBrief({
      visualToolPalette: DEVICE_PALETTE,
      visualConcept: "Elementor page builder on laptop",
    });
    expect(
      resolveMetaDeviceScreenLayout(brief, { focusKeyword: "small business website design" }),
    ).toBe("elementor_editor");
  });

  it("resolves neo-pulse dashboard from product context", () => {
    const brief = baseBrief({
      visualToolPalette: DEVICE_PALETTE,
      referenceAdPattern: "ad-01-bofu-action-list",
    });
    expect(resolveMetaDeviceScreenLayout(brief, { focusKeyword: "NEO Pulse action list" })).toBe(
      "neo_pulse_dashboard",
    );
  });

  it("returns none when device_screen is off", () => {
    expect(resolveMetaDeviceScreenLayout(baseBrief())).toBe("none");
  });
});

describe("buildMetaDeviceScreenLayoutBlock", () => {
  it("describes realistic layout and forbids readable screen text", () => {
    const block = buildMetaDeviceScreenLayoutBlock("elementor_editor");
    expect(block).toContain("Elementor-style page builder");
    expect(block).toContain("Gray placeholder bars only");
    expect(block).toContain("no readable words");
    expect(block).toContain("No abstract dashboards");
  });

  it("returns null for none", () => {
    expect(buildMetaDeviceScreenLayoutBlock("none")).toBeNull();
  });
});
