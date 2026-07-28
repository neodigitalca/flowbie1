import { describe, expect, it } from "vitest";
import {
  formatCitationHoursVertical,
  splitCondensedHoursBlob,
} from "@/lib/citation-research/citation-from-gmb-item";

describe("splitCondensedHoursBlob", () => {
  it("returns null for empty or single segment", () => {
    expect(splitCondensedHoursBlob("")).toBeNull();
    expect(splitCondensedHoursBlob("Monday: 10:00 a.m.–5:00 p.m.")).toBeNull();
  });

  it("splits run-on day lines into one line per day", () => {
    const s =
      "Monday: 10:00 a.m.–5:00 p.m. Tuesday: 10:00 a.m.–5:00 p.m. Wednesday: 10:00 a.m.–5:00 p.m. Thursday: 10:00 a.m.–5:00 p.m. Friday: 10:00 a.m.–5:00 p.m. Saturday: 10:00 a.m.–3:00 p.m. Sunday: Closed";
    const out = splitCondensedHoursBlob(s);
    expect(out).toBeTruthy();
    expect(out!.split("\n")).toHaveLength(7);
    expect(out).toContain("Monday:");
    expect(out).toContain("Sunday: Closed");
  });
});

describe("formatCitationHoursVertical", () => {
  it("expands condensed blob stored in hourMonday only", () => {
    const condensed =
      "Monday: 10:00 a.m.–5:00 p.m. Tuesday: 10:00 a.m.–5:00 p.m. Sunday: Closed";
    const rec = {
      businessName: "",
      address: "",
      phone: "",
      websiteUrl: "",
      gmbUrl: "",
      description: "",
      keywords: "",
      logoWide: "",
      logoSquare: "",
      instagramUrl: "",
      linkedinUrl: "",
      facebookUrl: "",
      discoveredUrls: "",
      hourMonday: condensed,
      hourTuesday: "",
      hourWednesday: "",
      hourThursday: "",
      hourFriday: "",
      hourSaturday: "",
      hourSunday: "",
    };
    const lines = formatCitationHoursVertical(rec).split("\n");
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines[0]).toMatch(/^Monday:/);
    expect(lines.some((l) => l.includes("Sunday: Closed"))).toBe(true);
  });

  it("uses per-day labels when each field has only a time range", () => {
    const rec = {
      businessName: "",
      address: "",
      phone: "",
      websiteUrl: "",
      gmbUrl: "",
      description: "",
      keywords: "",
      logoWide: "",
      logoSquare: "",
      instagramUrl: "",
      linkedinUrl: "",
      facebookUrl: "",
      discoveredUrls: "",
      hourMonday: "10:00-17:00",
      hourTuesday: "10:00-17:00",
      hourWednesday: "",
      hourThursday: "",
      hourFriday: "",
      hourSaturday: "",
      hourSunday: "Closed",
    };
    const out = formatCitationHoursVertical(rec);
    expect(out).toContain("Monday: 10:00-17:00");
    expect(out).toContain("Sunday: Closed");
  });
});
