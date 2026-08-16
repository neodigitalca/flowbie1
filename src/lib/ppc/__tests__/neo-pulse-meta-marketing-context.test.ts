import { describe, expect, it } from "vitest";
import {
  NEO_PULSE_PRODUCT_URL,
  appendNeoPulseMetaMarketingContext,
  buildMetaPageContextForGenerate,
  getNeoPulseMetaMarketingContextBlock,
  getNeoDigitalAgencyPovContextBlock,
  isNeoPulseProductLandingUrl,
  isNeoDigitalAgencyTeam,
  metaJobsNeedPageBucket,
  metaRowHasGenerateInput,
} from "@/lib/ppc/neo-pulse-meta-marketing-context";

describe("neo-pulse-meta-marketing-context", () => {
  it("matches Neo Digital agency team names", () => {
    expect(isNeoDigitalAgencyTeam("Neo Digital Inc.")).toBe(true);
    expect(isNeoDigitalAgencyTeam("Neo Digital Inc")).toBe(true);
    expect(isNeoDigitalAgencyTeam("Other Agency")).toBe(false);
  });

  it("includes neo-pulse product URL in context block", () => {
    const block = getNeoPulseMetaMarketingContextBlock();
    expect(block).toContain(NEO_PULSE_PRODUCT_URL);
    expect(block).toContain("marketing/instagram-ads");
  });

  it("uses program brief for NEO Pulse app selection", () => {
    expect(isNeoPulseProductLandingUrl(NEO_PULSE_PRODUCT_URL)).toBe(true);
    const block = buildMetaPageContextForGenerate(undefined, NEO_PULSE_PRODUCT_URL);
    expect(block).toContain("Program modules");
    expect(block).not.toContain("No landing page context");
  });

  it("allows generate with NEO Pulse app context source", () => {
    expect(
      metaRowHasGenerateInput({
        focusKeyword: "",
        contextSource: "neo-pulse_app",
      }),
    ).toBe(true);
  });

  it("allows generate with custom context URL", () => {
    expect(
      metaRowHasGenerateInput({
        focusKeyword: "",
        contextSource: "custom",
        contextUrl: "https://neodigital.ca/blog/elementor-help/",
      }),
    ).toBe(true);
  });

  it("includes agency POV without rejecting Elementor UI", () => {
    const block = getNeoDigitalAgencyPovContextBlock();
    expect(block).toContain("Elementor");
    expect(block).not.toContain("Reject Elementor dashboard");
    expect(block).toContain("We help Edmonton businesses");
    expect(block).toContain("We help Edmonton get found");
  });

  it("appends agency POV for Neo Digital custom context ads", () => {
    const prompt = appendNeoPulseMetaMarketingContext("Base prompt", "Neo Digital Inc.", {
      contextSource: "custom",
    });
    expect(prompt).toContain(getNeoDigitalAgencyPovContextBlock().slice(0, 30));
  });

  it("skips page bucket when jobs use custom context URLs", () => {
    expect(
      metaJobsNeedPageBucket([
        { contextSource: "custom", contextUrl: "https://neodigital.ca/blog/elementor-help/" },
      ]),
    ).toBe(false);
    expect(
      metaJobsNeedPageBucket([
        { contextSource: "neo-pulse_app" },
      ]),
    ).toBe(false);
    expect(metaJobsNeedPageBucket([{ landingPageUrl: "https://neodigital.ca/about/" }])).toBe(true);
  });
});
