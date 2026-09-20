import { describe, expect, it } from "vitest";
import { parseBrandAssets } from "../lib/classify-assets.mjs";
import { validateBrandAssetList } from "../schema/client-map.mjs";

describe("parseBrandAssets", () => {
  it("accepts a wrapped assets list", () => {
    const rows = parseBrandAssets({
      assets: [
        { filename: "logo.png", role: "logo_dark", personName: "", alt: "Logo" },
        { filename: "jindy.jpg", role: "person", personName: "Jindy Toor", alt: "Jindy Toor" },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0].role).toBe("logo_dark");
    expect(rows[1].personName).toBe("Jindy Toor");
  });

  it("rejects an unknown role", () => {
    expect(() =>
      validateBrandAssetList([{ filename: "x.png", role: "hero", personName: "", alt: "" }]),
    ).toThrow(/role/);
  });

  it("rejects a missing filename", () => {
    expect(() => parseBrandAssets({ assets: [{ role: "other" }] })).toThrow(/filename/);
  });
});
