import { describe, it, expect } from "vitest";
import {
  inferDataForSeoLocationNameFromWebsiteUrl,
  isValidWebsiteUrlForGmbInference,
} from "../local-strategy-gmb-fetch";

describe("inferDataForSeoLocationNameFromWebsiteUrl", () => {
  it("maps .ca to Canada", () => {
    expect(inferDataForSeoLocationNameFromWebsiteUrl("https://ridgelinesolar.ca/")).toBe("Canada");
  });
  it("defaults unknown TLD to United States", () => {
    expect(inferDataForSeoLocationNameFromWebsiteUrl("https://example.com")).toBe("United States");
  });
});

describe("isValidWebsiteUrlForGmbInference", () => {
  it("rejects empty and invalid", () => {
    expect(isValidWebsiteUrlForGmbInference(undefined)).toBe(false);
    expect(isValidWebsiteUrlForGmbInference("")).toBe(false);
    expect(isValidWebsiteUrlForGmbInference("   ")).toBe(false);
    expect(isValidWebsiteUrlForGmbInference("not a url")).toBe(false);
  });
  it("accepts hostnames with or without scheme", () => {
    expect(isValidWebsiteUrlForGmbInference("https://example.com/path")).toBe(true);
    expect(isValidWebsiteUrlForGmbInference("blindmagic.com")).toBe(true);
  });
});
