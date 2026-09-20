import type { AdsMetrics } from "@/lib/ads-reporting/ads-reporting-types";
import { adsPctDelta, microsToSpend } from "@/lib/ads-reporting/ads-reporting-metrics";

export type AdsCompareSignals = {
  compareKind: "mom" | "yoy" | "custom";
  compareLabel: string;
  primaryPattern: "spend_up_efficient" | "spend_up_soft" | "spend_down" | "mixed_or_flat";
  interpretation: string;
  metrics: {
    spendPct: string;
    clicksPct: string;
    impressionsPct: string;
    conversionsPct: string;
  };
};

function signedPct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return " - ";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

export function deriveAdsCompareSignals(input: {
  compareKind: "mom" | "yoy" | "custom";
  compareLabel: string;
  primary: AdsMetrics;
  compare: AdsMetrics;
}): AdsCompareSignals {
  const spendP = microsToSpend(input.primary.costMicros);
  const spendC = microsToSpend(input.compare.costMicros);
  const spendPct = adsPctDelta(spendP, spendC);
  const clicksPct = adsPctDelta(input.primary.clicks, input.compare.clicks);
  const impressionsPct = adsPctDelta(input.primary.impressions, input.compare.impressions);
  const conversionsPct = adsPctDelta(input.primary.conversions, input.compare.conversions);
  let primaryPattern: AdsCompareSignals["primaryPattern"] = "mixed_or_flat";
  let interpretation = "Mixed paid-media signals; qualify claims from spend, clicks, and conversions together.";
  if ((spendPct ?? 0) > 5 && (conversionsPct ?? 0) >= 0) {
    primaryPattern = "spend_up_efficient";
    interpretation = "Spend rose with conversions holding or growing.";
  } else if ((spendPct ?? 0) > 5 && (conversionsPct ?? 0) < 0) {
    primaryPattern = "spend_up_soft";
    interpretation = "Spend rose while conversions softened.";
  } else if ((spendPct ?? 0) < -5) {
    primaryPattern = "spend_down";
    interpretation = "Paid spend pulled back versus the prior period.";
  }
  return {
    compareKind: input.compareKind,
    compareLabel: input.compareLabel,
    primaryPattern,
    interpretation,
    metrics: {
      spendPct: signedPct(spendPct),
      clicksPct: signedPct(clicksPct),
      impressionsPct: signedPct(impressionsPct),
      conversionsPct: signedPct(conversionsPct),
    },
  };
}

export function adsCompareSignalsFileContent(signals: AdsCompareSignals): string {
  return [
    `compareKind: ${signals.compareKind}`,
    `compareLabel: ${signals.compareLabel}`,
    `primaryPattern: ${signals.primaryPattern}`,
    `interpretation: ${signals.interpretation}`,
    `spendPct: ${signals.metrics.spendPct}`,
    `clicksPct: ${signals.metrics.clicksPct}`,
    `impressionsPct: ${signals.metrics.impressionsPct}`,
    `conversionsPct: ${signals.metrics.conversionsPct}`,
  ].join("\n");
}
