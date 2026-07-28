import { describe, expect, it } from "vitest";
import {
  buildGscReportingMicroSnapshot,
  GSC_REPORT_LABEL,
  gscReportingProgressBusy,
} from "../gsc-reporting-header-progress";

describe("buildGscReportingMicroSnapshot", () => {
  it("returns null when progress is missing", () => {
    expect(buildGscReportingMicroSnapshot(null)).toBeNull();
    expect(buildGscReportingMicroSnapshot(undefined)).toBeNull();
  });

  it("maps step, total, and label as statusMessage", () => {
    const snap = buildGscReportingMicroSnapshot({
      step: 2,
      total: 5,
      label: "Writing section 2…",
    });
    expect(snap?.label).toBe(GSC_REPORT_LABEL);
    expect(snap?.completed).toBe(2);
    expect(snap?.total).toBe(5);
    expect(snap?.statusMessage).toBe("Writing section 2…");
    expect(snap?.progressPct).toBe(40);
  });

  it("omits statusMessage when label matches phase", () => {
    const snap = buildGscReportingMicroSnapshot({
      step: 0,
      total: 1,
      label: GSC_REPORT_LABEL,
    });
    expect(snap?.statusMessage).toBeUndefined();
  });
});

describe("gscReportingProgressBusy", () => {
  it("is false when idle", () => {
    expect(gscReportingProgressBusy(null)).toBe(false);
  });

  it("is true when progress has a label", () => {
    expect(gscReportingProgressBusy({ step: 1, total: 3, label: "Fetching…" })).toBe(true);
  });
});
