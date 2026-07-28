import { describe, it, expect } from "vitest";
import { getGoogleBusinessInfoItem, parseGmbDfsBusinessInfo } from "../gmb-dfs-parse";

describe("getGoogleBusinessInfoItem", () => {
  it("returns null when JSON root is null (API body null)", () => {
    expect(getGoogleBusinessInfoItem(null)).toBeNull();
  });

  it("returns null for non-object JSON", () => {
    expect(getGoogleBusinessInfoItem(undefined)).toBeNull();
    expect(getGoogleBusinessInfoItem("string")).toBeNull();
  });
});

describe("parseGmbDfsBusinessInfo", () => {
  it("does not throw when response is null", () => {
    expect(parseGmbDfsBusinessInfo(null)).toBeNull();
  });
});
