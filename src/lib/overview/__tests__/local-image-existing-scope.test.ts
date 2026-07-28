import { describe, expect, it } from "vitest";
import {
  gateLocalImageExistingScope,
  normalizeLocalImageExistingScope,
} from "@/lib/overview/local-image-existing-scope";

describe("normalizeLocalImageExistingScope", () => {
  it("defaults to new", () => {
    expect(normalizeLocalImageExistingScope(undefined)).toBe("new");
  });

  it("keeps old and all", () => {
    expect(normalizeLocalImageExistingScope("old")).toBe("old");
    expect(normalizeLocalImageExistingScope("all")).toBe("all");
  });
});

describe("gateLocalImageExistingScope", () => {
  it("new skips when image already present", () => {
    expect(gateLocalImageExistingScope("new", true)).toEqual({
      action: "skip",
      reason: "Skipped — Local Image already present on this page.",
    });
  });

  it("new generates when no image", () => {
    expect(gateLocalImageExistingScope("new", false)).toEqual({
      action: "generate",
      stripExisting: false,
    });
  });

  it("old skips when no image to replace", () => {
    expect(gateLocalImageExistingScope("old", false)).toEqual({
      action: "skip",
      reason: "Skipped — no Local Image to replace on this page.",
    });
  });

  it("old strips and generates when image present", () => {
    expect(gateLocalImageExistingScope("old", true)).toEqual({
      action: "generate",
      stripExisting: true,
    });
  });

  it("all generates without strip when empty", () => {
    expect(gateLocalImageExistingScope("all", false)).toEqual({
      action: "generate",
      stripExisting: false,
    });
  });

  it("all strips and generates when image present", () => {
    expect(gateLocalImageExistingScope("all", true)).toEqual({
      action: "generate",
      stripExisting: true,
    });
  });
});
