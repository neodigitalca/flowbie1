import { describe, expect, it } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import type { GscSiteQueryRow } from "@/lib/competitor-research/types";
import {
  canUseBlindMagicKeywordOption,
  findBlindMagicPeerSite,
  isBlindMagicSite,
  isBlindsCompanySite,
  stripPeerBrandFromGscQueries,
} from "@/lib/local-analysis/blind-magic-peer-gsc";

function site(overrides: Partial<WordPressSite>): WordPressSite {
  return {
    id: "s1",
    name: "Site",
    siteUrl: "https://example.com",
    username: "",
    appPassword: "",
    connectedAt: Date.now(),
    enabled: true,
    ...overrides,
  } as WordPressSite;
}

function gscRow(query: string): GscSiteQueryRow {
  return { query, clicks: 1, impressions: 10, ctr: 0.1, position: 4 };
}

describe("blind-magic-peer-gsc", () => {
  it("recognizes Blind Magic by name or host", () => {
    expect(isBlindMagicSite(site({ name: "Blind Magic Window Coverings" }))).toBe(true);
    expect(isBlindMagicSite(site({ name: "Other", siteUrl: "https://blindmagic.com" }))).toBe(true);
    expect(isBlindMagicSite(site({ name: "Lindsey Blinds" }))).toBe(false);
  });

  it("treats Lindsey Blinds as a blinds company", () => {
    expect(isBlindsCompanySite(site({ name: "Lindsey Blinds" }))).toBe(true);
    expect(isBlindsCompanySite(site({ name: "Flowbie" }))).toBe(false);
  });

  it("finds Blind Magic as a peer and skips the current site", () => {
    const peer = site({
      id: "bm",
      name: "Blind Magic",
      siteUrl: "https://blindmagic.com",
    });
    const current = site({ id: "lb", name: "Lindsey Blinds" });
    expect(findBlindMagicPeerSite([current, peer], "lb")?.id).toBe("bm");
    expect(findBlindMagicPeerSite([peer], "bm")).toBeNull();
    expect(
      findBlindMagicPeerSite(
        [site({ id: "bm", name: "Blind Magic", siteUrl: "https://blindmagic.com", enabled: false })],
        "lb",
      )?.id,
    ).toBe("bm");
  });

  it("offers the option only for a blinds company with a Blind Magic peer", () => {
    const peer = site({ id: "bm", name: "Blind Magic", siteUrl: "https://blindmagic.com" });
    const lindsey = site({ id: "lb", name: "Lindsey Blinds" });
    const flowbie = site({ id: "fb", name: "Flowbie" });
    expect(canUseBlindMagicKeywordOption([lindsey, peer], lindsey)).toBe(true);
    expect(canUseBlindMagicKeywordOption([flowbie, peer], flowbie)).toBe(false);
    expect(canUseBlindMagicKeywordOption([lindsey], lindsey)).toBe(false);
    expect(canUseBlindMagicKeywordOption([peer], peer)).toBe(false);
  });

  it("drops Blind Magic brand queries from the peer GSC list", () => {
    const kept = stripPeerBrandFromGscQueries(
      [
        gscRow("blinds edmonton"),
        gscRow("blind magic window coverings"),
        gscRow("roller shades"),
      ],
      "Blind Magic Window Coverings",
    );
    expect(kept.map((r) => r.query)).toEqual(["blinds edmonton", "roller shades"]);
  });
});
