import { afterEach, describe, expect, it, vi } from "vitest";
import { generateSEOSlug, normalizeLocationForSeoSlug } from "../seo-slug-generator";

describe("normalizeLocationForSeoSlug", () => {
  it("drops metropolitan area noise", () => {
    expect(normalizeLocationForSeoSlug("Marietta, Atlanta metropolitan area, GA")).toBe("Marietta, GA");
  });

  it("keeps city and state when no noise", () => {
    expect(normalizeLocationForSeoSlug("Marietta, GA")).toBe("Marietta, GA");
  });
});

describe("generateSEOSlug", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns empty when primary keyword is empty", async () => {
    await expect(generateSEOSlug("Title", "", "Marietta, GA", "sk-test")).resolves.toBe("");
  });

  it("returns empty when API key missing", async () => {
    await expect(generateSEOSlug("Title", "keyword", "Marietta, GA", "")).resolves.toBe("");
  });

  it("returns empty on fetch rejection", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("network"));
    await expect(generateSEOSlug("Title", "keyword", "Marietta, GA", "sk-test")).resolves.toBe("");
  });

  it("returns empty when response not ok", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });
    await expect(generateSEOSlug("Title", "keyword", null, "sk-test")).resolves.toBe("");
  });

  it("returns empty when model content empty", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "" } }] }),
    });
    await expect(generateSEOSlug("Title", "keyword", "Marietta, GA", "sk-test")).resolves.toBe("");
  });

  it("returns sanitized slug from model output", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "chiro-sports-injury-douglasdale-calgary-ab" } }],
      }),
    });
    await expect(
      generateSEOSlug("Sports Injury Chiropractor in Douglasdale, Calgary", "sports injury chiropractor", "Douglasdale, Calgary, AB", "sk-test"),
    ).resolves.toBe("chiro-sports-injury-douglasdale-calgary-ab");
    const body = JSON.parse((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.model).toBe("google/gemini-2.5-flash-lite");
  });
});
