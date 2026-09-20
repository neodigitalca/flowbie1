import { describe, expect, it } from "vitest";
import {
  OVERVIEW_AI_COPY_STREAM_CONCURRENCY,
  mapOverviewAiCopyWithConcurrency,
} from "@/lib/overview/overview-ai-copy-concurrency";

describe("mapOverviewAiCopyWithConcurrency", () => {
  it("keeps at most OVERVIEW_AI_COPY_STREAM_CONCURRENCY rows in flight", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = [0, 1, 2, 3, 4, 5, 6, 7];

    await mapOverviewAiCopyWithConcurrency(items, async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 20));
      inFlight -= 1;
    });

    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(OVERVIEW_AI_COPY_STREAM_CONCURRENCY);
  });
});
