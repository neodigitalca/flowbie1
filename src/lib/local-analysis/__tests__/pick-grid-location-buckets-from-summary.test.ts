import { describe, expect, it, vi } from "vitest";
import {
  parseGridLocationBucketsFromSummaryJson,
  pickGridLocationBucketsFromSummary,
} from "@/lib/local-analysis/pick-grid-location-buckets-from-summary";

const blindMagicSummary = `## Local grid scan
- Grid points used in this summary: 67
- Keywords in scan: Blind Magic Window Coverings

### Keyword: "Blind Magic Window Coverings"
- rank 20.98 - business: Budget Blinds of Sherwood Park
- rank 15.53 - business: Gotcha Covered of NW Edmonton and St. Albert
- rank 7.08 - business: Blind Magic Window Coverings; address: (780) 484-2390
- rank 4.95 - business: Linh's Window Fashions
`;

describe("parseGridLocationBucketsFromSummaryJson", () => {
  it("maps model JSON to grid location buckets", () => {
    const buckets = parseGridLocationBucketsFromSummaryJson(
      JSON.stringify({
        buckets: [
          {
            placeLabel: "Sherwood Park, AB",
            priorityWeight: 18,
            sampleAddresses: ["Budget Blinds of Sherwood Park"],
          },
          {
            placeLabel: "St. Albert, AB",
            priorityWeight: 14,
            sampleAddresses: ["Gotcha Covered of NW Edmonton and St. Albert"],
          },
        ],
      }),
      3,
    );
    expect(buckets).toHaveLength(2);
    expect(buckets[0]?.placeLabel).toBe("Sherwood Park, AB");
    expect(buckets[0]?.weight).toBe(18);
  });
});

describe("pickGridLocationBucketsFromSummary", () => {
  it("calls OpenRouter when CSV addresses are unusable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          ok: true,
          content: JSON.stringify({
            buckets: [
              {
                placeLabel: "Edmonton, AB",
                priorityWeight: 16,
                sampleAddresses: ["Gotcha Covered of NW Edmonton and St. Albert"],
              },
            ],
          }),
          raw: {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    buckets: [
                      {
                        placeLabel: "Edmonton, AB",
                        priorityWeight: 16,
                        sampleAddresses: ["Gotcha Covered of NW Edmonton and St. Albert"],
                      },
                    ],
                  }),
                },
              },
            ],
          },
        }),
      ),
    );

    const buckets = await pickGridLocationBucketsFromSummary({
      apiKey: "test-key",
      gridSummaryMarkdown: blindMagicSummary,
      gridRows: [],
      bucketCount: 1,
      wantsNeighbourhoods: true,
      businessName: "Blind Magic Window Coverings",
    });

    expect(buckets[0]?.placeLabel).toBe("Edmonton, AB");
  });
});
