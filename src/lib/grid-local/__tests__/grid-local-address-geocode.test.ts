import { describe, expect, it, vi, beforeEach } from "vitest";
import { geocodeStreetAddressViaOpenRouter } from "@/lib/grid-local/grid-local-address-geocode";

vi.mock("@/lib/api", () => ({
  loadApiKey: () => "test-key",
}));

vi.mock("@/lib/optimization-settings-storage", () => ({
  getResearchModel: () => "google/gemini-2.5-flash-lite",
}));

describe("geocodeStreetAddressViaOpenRouter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns lat/lng from Gemini JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"lat":53.5518643,"lng":-113.6142382}' } }],
        }),
      }),
    );

    const hit = await geocodeStreetAddressViaOpenRouter(
      "10615 170 St NW, Edmonton Alberta T5P 4W2, CA",
      "site-1",
    );
    expect(hit.lat).toBeCloseTo(53.5518643, 4);
    expect(hit.lng).toBeCloseTo(-113.6142382, 4);
  });
});
