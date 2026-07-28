import { describe, expect, it } from "vitest";
import {
  buildGridDestinationPreservingPermalink,
  optimizeGridDestinationForAiseo,
  permalinkParentPrefixFromClusterMembers,
} from "@/lib/sitemap-optimizer/grid-destination-aiseo-policy";

const members2014 = ["https://www.kwbllp.com/2014/06/24/online-backups-keeping-it-simple/"];
const members2025 = [
  "https://www.kwbllp.com/2025/12/09/why-yellowknife-businesses-should-use-cloud-accounting/",
  "https://www.kwbllp.com/2025/12/09/cloud-accounting-yellowknife/",
];

describe("grid-destination-aiseo-policy", () => {
  it("uses mode permalink prefix from cluster members only", () => {
    const prefix = permalinkParentPrefixFromClusterMembers([
      "https://www.kwbllp.com/2014/06/24/online-backups/",
      "https://www.kwbllp.com/2014/06/24/director-liability/",
      "https://www.kwbllp.com/2026/03/05/quickbooks/",
    ]);
    expect(prefix).toBe("2014/06/24/");
  });

  it("keeps /YYYY/MM/DD/ parent path from member URLs", () => {
    const out = buildGridDestinationPreservingPermalink(
      members2014,
      "online backups simple",
      "Online Backups Keeping It Simple",
    );
    expect(out).toBe("https://www.kwbllp.com/2014/06/24/online-backups-simple/");
  });

  it("uses most common date path when members share it", () => {
    const out = buildGridDestinationPreservingPermalink(
      members2025,
      "yellowknife cloud accounting",
      "Yellowknife Cloud Accounting",
    );
    expect(out).toContain("/2025/12/09/");
    expect(out).not.toMatch(/yellowknife-businesses-should-use/);
    const slug = new URL(out!).pathname.split("/").filter(Boolean).pop();
    expect(slug!.length).toBeLessThanOrEqual(48);
  });

  it("does not strip date folders from an over-long model URL", () => {
    const long =
      "https://www.kwbllp.com/2026/01/08/profit-improvement-strategies-for-construction-trades-business-owners-introducing-the-profit-accelerator-program/";
    const out = optimizeGridDestinationForAiseo(
      long,
      "profit improvement construction",
      "Profit Improvement Strategies for Construction",
      members2014,
    );
    expect(out).toContain("/2014/06/24/");
    expect(out).not.toContain("/2026/");
  });

  it("keeps dated path from cluster members when shortening slug", () => {
    const members = ["https://www.kwbllp.com/2025/12/09/yellowknife-cloud-accounting/"];
    const out = optimizeGridDestinationForAiseo(
      "https://www.kwbllp.com/yellowknife-business-strategies/",
      "yellowknife cloud accounting",
      "Yellowknife Cloud Accounting",
      members,
    );
    expect(out).toContain("/2025/12/09/");
  });
});
