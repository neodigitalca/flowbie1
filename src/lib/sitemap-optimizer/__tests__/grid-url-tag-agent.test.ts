import { describe, expect, it } from "vitest";
import {
  SITEMAP_OPTIMIZER_GRID_URL_TAG_BATCH_CONCURRENCY,
  SITEMAP_OPTIMIZER_GRID_URL_TAG_BATCH_SIZE,
} from "@/lib/sitemap-optimizer/constants";

describe("grid url tag agent batching", () => {
  it("tags in parallel batches capped by concurrency constant", () => {
    expect(SITEMAP_OPTIMIZER_GRID_URL_TAG_BATCH_SIZE).toBe(25);
    expect(SITEMAP_OPTIMIZER_GRID_URL_TAG_BATCH_CONCURRENCY).toBe(4);
  });
});
