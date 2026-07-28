import { describe, expect, it } from "vitest";

import {
  createPeerFeaturedImageReportCollector,
  formatPeerFeaturedImageReportMarkdown,
  peerFeaturedImageReportHasContent,
  recordPeerFeaturedImageOutcome,
} from "@/lib/bulk/peer-featured-image-report";

describe("peer featured image report", () => {
  it("lists found rows with their peer source and generated rows without one", () => {
    const collector = createPeerFeaturedImageReportCollector();
    recordPeerFeaturedImageOutcome(collector, {
      action: "generated",
      rowIndex: 1,
      rowLabel: "Custom Blinds Edmonton",
      matchKey: "custom blinds edmonton",
      mode: "blog",
      generator: "ai",
    });
    recordPeerFeaturedImageOutcome(collector, {
      action: "found",
      rowIndex: 0,
      rowLabel: "Alberta Avenue Edmonton",
      matchKey: "Alberta Avenue Edmonton",
      mode: "entity",
      sourceSiteName: "Heritage Dental Centre",
      sourcePageUrl: "https://peer.example.com/alberta-avenue-edmonton/",
      sourceImageUrl: "https://peer.example.com/wp-content/uploads/aa.jpg",
      matchedKeyword: "alberta avenue edmonton",
      score: 3,
    });
    recordPeerFeaturedImageOutcome(collector, {
      action: "none",
      rowIndex: 2,
      rowLabel: "No Image Row",
    });

    const md = formatPeerFeaturedImageReportMarkdown(collector);

    expect(md).toContain("- Found on peer sites: 1");
    expect(md).toContain("- Generated: 1");
    expect(md).toContain("- No featured image: 1");

    // Sorted by row index; found row lists the full source.
    const foundIdx = md.indexOf("## Row 1: Alberta Avenue Edmonton");
    const generatedIdx = md.indexOf("## Row 2: Custom Blinds Edmonton");
    expect(foundIdx).toBeGreaterThan(-1);
    expect(generatedIdx).toBeGreaterThan(foundIdx);
    expect(md).toContain("- Source site: Heritage Dental Centre");
    expect(md).toContain("- Source page: https://peer.example.com/alberta-avenue-edmonton/");
    expect(md).toContain("- Source image: https://peer.example.com/wp-content/uploads/aa.jpg");
    expect(md).toContain("(exact)");
    expect(md).toContain("Action: Generated (AI image; no peer match for custom blinds edmonton)");
    expect(md).toContain("- Action: No featured image requested");
  });

  it("reports content only when a row attempted peer reuse", () => {
    const empty = createPeerFeaturedImageReportCollector();
    expect(peerFeaturedImageReportHasContent(empty)).toBe(false);

    recordPeerFeaturedImageOutcome(empty, {
      action: "none",
      rowIndex: 0,
      rowLabel: "n row",
    });
    expect(peerFeaturedImageReportHasContent(empty)).toBe(false);

    recordPeerFeaturedImageOutcome(empty, {
      action: "generated",
      rowIndex: 1,
      rowLabel: "gen row",
      matchKey: "kw",
      mode: "blog",
      generator: "google-maps",
    });
    expect(peerFeaturedImageReportHasContent(empty)).toBe(true);
  });
});
