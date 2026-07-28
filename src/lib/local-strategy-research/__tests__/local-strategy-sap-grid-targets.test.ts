import { describe, expect, it } from "vitest";
import {
  buildLocalStrategySapKeywordTargetsFromGrid,
  LOCAL_STRATEGY_SAP_SCHEDULE_TOTAL_ROWS,
} from "@/lib/local-strategy-research/local-strategy-sap-schedule-from-grid";

describe("buildLocalStrategySapKeywordTargetsFromGrid", () => {
  it("allocates 45 rows across weighted grid keywords with entity hints", () => {
    const targets = buildLocalStrategySapKeywordTargetsFromGrid({
      gridKeywordWeights: [
        { keyword: "dental implants", weight: 10 },
        { keyword: "teeth cleaning", weight: 5 },
      ],
      placeHints: ["Downtown", "Beltline"],
      geoLabel: "Calgary, AB",
      entityLocation: null,
      targetTotal: LOCAL_STRATEGY_SAP_SCHEDULE_TOTAL_ROWS,
    });
    const total = targets.reduce((s, t) => s + t.sapPages, 0);
    expect(total).toBe(LOCAL_STRATEGY_SAP_SCHEDULE_TOTAL_ROWS);
    expect(targets.every((t) => t.keyword === "dental implants" || t.keyword === "teeth cleaning")).toBe(true);
    expect(targets.every((t) => t.entityHint?.includes("Calgary"))).toBe(true);
  });
});
