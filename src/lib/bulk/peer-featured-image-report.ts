/**
 * End-of-run report: where each row's featured image came from.
 * "found" rows list the peer source; "generated" rows list the generator used.
 */

export const PEER_FEATURED_IMAGE_REPORT_FILENAME = "peer-featured-image-report.md";

export type PeerFeaturedImageOutcome =
  | {
      action: "found";
      rowIndex: number;
      rowLabel: string;
      matchKey: string;
      mode: "entity" | "blog";
      sourceSiteName: string;
      sourcePageUrl: string;
      sourceImageUrl: string;
      matchedKeyword: string;
      score: number;
    }
  | {
      action: "generated";
      rowIndex: number;
      rowLabel: string;
      matchKey: string;
      mode: "entity" | "blog";
      generator: "google-maps" | "ai";
    }
  | {
      action: "none";
      rowIndex: number;
      rowLabel: string;
    };

export type PeerFeaturedImageReportCollector = {
  outcomes: PeerFeaturedImageOutcome[];
};

export function createPeerFeaturedImageReportCollector(): PeerFeaturedImageReportCollector {
  return { outcomes: [] };
}

export function recordPeerFeaturedImageOutcome(
  collector: PeerFeaturedImageReportCollector,
  outcome: PeerFeaturedImageOutcome,
): void {
  collector.outcomes.push(outcome);
}

function scoreLabel(score: number): string {
  if (score >= 3) return "exact";
  if (score >= 2) return "contains";
  return "fuzzy";
}

export function formatPeerFeaturedImageReportMarkdown(
  collector: PeerFeaturedImageReportCollector,
): string {
  const outcomes = [...collector.outcomes].sort((a, b) => a.rowIndex - b.rowIndex);
  const foundCount = outcomes.filter((o) => o.action === "found").length;
  const generatedCount = outcomes.filter((o) => o.action === "generated").length;
  const noneCount = outcomes.filter((o) => o.action === "none").length;

  const lines: string[] = [
    "# Featured image sources",
    "",
    `- Found on peer sites: ${foundCount}`,
    `- Generated: ${generatedCount}`,
    `- No featured image: ${noneCount}`,
    "",
  ];

  for (const o of outcomes) {
    lines.push(`## Row ${o.rowIndex + 1}: ${o.rowLabel || "(untitled)"}`);
    if (o.action === "found") {
      lines.push("");
      lines.push(`- Action: Found on peer (${o.mode === "entity" ? "SAP entity" : "blog keyword"} match)`);
      lines.push(`- Match key: ${o.matchKey}`);
      lines.push(`- Matched against: ${o.matchedKeyword} (${scoreLabel(o.score)})`);
      lines.push(`- Source site: ${o.sourceSiteName}`);
      lines.push(`- Source page: ${o.sourcePageUrl}`);
      lines.push(`- Source image: ${o.sourceImageUrl}`);
    } else if (o.action === "generated") {
      lines.push("");
      lines.push(
        `- Action: Generated (${o.generator === "google-maps" ? "Google Maps" : "AI image"}; no peer match for ${o.matchKey})`,
      );
    } else {
      lines.push("");
      lines.push("- Action: No featured image requested");
    }
    lines.push("");
  }

  return lines.join("\n");
}

/** True when the run had at least one row that attempted peer reuse. */
export function peerFeaturedImageReportHasContent(
  collector: PeerFeaturedImageReportCollector,
): boolean {
  return collector.outcomes.some((o) => o.action === "found" || o.action === "generated");
}
