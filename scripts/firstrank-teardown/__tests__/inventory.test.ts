import { describe, expect, it } from "vitest";
import {
  ALLOWED_METHOD,
  assertGet,
  extractJsonLd,
  jsonLdTypes,
  navigationOk,
  proxiedGetHeaders,
  requireConfiguredProxy,
} from "../lib.mjs";
import { ROLES, validateClassified } from "../classify.mjs";

describe("firstrank teardown crawl contract", () => {
  it("treats 304 as a successful GET", () => {
    expect(navigationOk({ status: () => 200 })).toBe(true);
    expect(navigationOk({ status: () => 304 })).toBe(true);
    expect(navigationOk({ status: () => 404 })).toBe(false);
  });

  it("allows GET only", () => {
    expect(ALLOWED_METHOD).toBe("GET");
    expect(() => assertGet("GET")).not.toThrow();
    expect(() => assertGet("POST")).toThrow(/Only GET/);
    expect(() => assertGet("PUT")).toThrow(/Only GET/);
  });

  it("requires the residential proxy", () => {
    expect(() =>
      requireConfiguredProxy({
        OXYLABS_PROXY_HOST: "",
        OXYLABS_PROXY_PORT: "",
        OXYLABS_PROXY_USERNAME: "",
        OXYLABS_PROXY_PASSWORD: "",
      }),
    ).toThrow(/Residential proxy is required/);
  });

  it("sends a Chrome UA and Canadian language with no product identity", () => {
    const headers = proxiedGetHeaders();
    expect(headers["User-Agent"]).toContain("Chrome/");
    expect(headers["Accept-Language"]).toContain("en-CA");
    const blob = JSON.stringify(headers).toLowerCase();
    expect(blob).not.toContain("neo pulse");
    expect(blob).not.toContain("neodigital");
    expect(blob).not.toContain("cursor");
    expect(headers).not.toHaveProperty("Referer");
  });

  it("parses JSON-LD types from public HTML", () => {
    const html = `<html><script type="application/ld+json">{"@type":"FAQPage"}</script></html>`;
    const blocks = extractJsonLd(html);
    expect(jsonLdTypes(blocks)).toEqual(["FAQPage"]);
  });

  it("rejects invalid classify output", () => {
    const link = "https://www.firstrank.ca/edmonton-seo/";
    expect(() =>
      validateClassified(
        {
          items: [
            {
              link,
              role: "city-seo",
              cluster: "edmonton",
              edmonton_relevant: true,
              reason: "city lander",
            },
          ],
        },
        [link],
      ),
    ).not.toThrow();
    expect(() => validateClassified({ items: [] }, [link])).toThrow(/missing a required link/);
    expect(ROLES).toContain("edmonton-spoke");
  });
});
