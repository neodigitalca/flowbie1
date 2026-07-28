import { describe, it, expect } from "vitest";
import {
  gbpPostAggregateHarnessProgress,
  gbpPostHeaderProgressFromState,
} from "@/lib/gbp-post/gbp-post-header-progress";

describe("gbpPostAggregateHarnessProgress", () => {
  it("sums done sections across sites", () => {
    const result = gbpPostAggregateHarnessProgress(
      {
        a: [
          { sectionIndex: 0, title: "Topic", status: "done" },
          { sectionIndex: 1, title: "Site page", status: "generating" },
        ],
        b: [
          { sectionIndex: 0, title: "Topic", status: "done" },
          { sectionIndex: 1, title: "Site page", status: "done" },
          { sectionIndex: 2, title: "Post card", status: "done" },
        ],
      },
      2,
    );
    expect(result).toEqual({ completed: 4, total: 6 });
  });
});

describe("gbpPostHeaderProgressFromState parallel", () => {
  it("uses aggregate harness when harnessBySiteId is set", () => {
    const progress = gbpPostHeaderProgressFromState({
      isProcessing: true,
      statusLine: "Posting 2 sites in parallel…",
      harnessSections: [],
      harnessPlannedSectionCount: null,
      harnessBySiteId: {
        a: [{ sectionIndex: 0, title: "Topic", status: "done" }],
        b: [{ sectionIndex: 0, title: "Topic", status: "done" }],
      },
      parallelSiteCount: 2,
    });
    expect(progress).toMatchObject({
      completed: 2,
      total: 6,
      harnessActive: true,
      progressPct: 33,
    });
  });
});
