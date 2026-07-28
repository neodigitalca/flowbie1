import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  fetchWikipediaPageImageUrl,
  fetchWikipediaPageLeadImage,
  resolveWikipediaPageTitleForEntity,
} from "../mediawiki-pageimage";

describe("resolveWikipediaPageTitleForEntity", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns exact title when the page exists", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          query: {
            pages: [{ title: "Aldergrove, Edmonton" }],
          },
        }),
      }),
    );

    const out = await resolveWikipediaPageTitleForEntity("Aldergrove, Edmonton");
    expect(out).toMatchObject({
      title: "Aldergrove, Edmonton",
    });
    expect(out?.pageUrl).toContain("en.wikipedia.org/wiki/");
    expect(out?.pageUrl).toContain("Aldergrove");
  });

  it("falls back to first search hit when exact title is missing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: { pages: [{ title: "Aldergrove Edmonton", missing: true }] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: {
            search: [{ title: "Aldergrove, Edmonton" }],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: { pages: [{ title: "Aldergrove, Edmonton" }] },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const out = await resolveWikipediaPageTitleForEntity("Aldergrove Edmonton");
    expect(out?.title).toBe("Aldergrove, Edmonton");
  });

  it("returns null when entity is empty", async () => {
    expect(await resolveWikipediaPageTitleForEntity("")).toBeNull();
  });
});

describe("fetchWikipediaPageImageUrl", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("prefers original source over thumbnail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          query: {
            pages: [
              {
                title: "Aldergrove, Edmonton",
                original: { source: "https://upload.wikimedia.org/original.jpg" },
                thumbnail: { source: "https://upload.wikimedia.org/thumb.jpg" },
              },
            ],
          },
        }),
      }),
    );

    const url = await fetchWikipediaPageImageUrl("Aldergrove, Edmonton");
    expect(url).toBe("https://upload.wikimedia.org/original.jpg");
  });

  it("falls back to thumbnail when original is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          query: {
            pages: [
              {
                title: "Aldergrove, Edmonton",
                thumbnail: { source: "https://upload.wikimedia.org/thumb.jpg" },
              },
            ],
          },
        }),
      }),
    );

    const url = await fetchWikipediaPageImageUrl("Aldergrove, Edmonton");
    expect(url).toBe("https://upload.wikimedia.org/thumb.jpg");
  });

  it("returns null when page has no pageimage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          query: { pages: [{ title: "No Image Place" }] },
        }),
      }),
    );

    expect(await fetchWikipediaPageImageUrl("No Image Place")).toBeNull();
  });
});

describe("fetchWikipediaPageLeadImage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns title, pageUrl, and imageUrl when pageimage exists", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: { pages: [{ title: "Aldergrove, Edmonton" }] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: {
            pages: [
              {
                title: "Aldergrove, Edmonton",
                original: {
                  source: "https://upload.wikimedia.org/wikipedia/commons/a/a1/Aldergrove.jpg",
                },
              },
            ],
          },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const lead = await fetchWikipediaPageLeadImage("Aldergrove, Edmonton");
    expect(lead).toEqual({
      title: "Aldergrove, Edmonton",
      pageUrl: expect.stringContaining("Aldergrove"),
      imageUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a1/Aldergrove.jpg",
    });
  });

  it("returns null when pageimage is missing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: { pages: [{ title: "Some Place" }] },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          query: { pages: [{ title: "Some Place" }] },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchWikipediaPageLeadImage("Some Place")).toBeNull();
  });
});
