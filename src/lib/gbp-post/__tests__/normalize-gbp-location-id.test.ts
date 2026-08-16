import { describe, expect, it } from "vitest";
import {
  gbpLocationIdCandidates,
  gbpLocationIdPostCandidates,
  normalizeGbpLocationIdInput,
  persistGbpLocationIdInput,
} from "@/lib/gbp-post/normalize-gbp-location-id";

const BLIND_MAGIC_URL =
  "https://business.google.com/n/16551297259505229427/profile?fid=12306432658930552311";

describe("normalizeGbpLocationIdInput", () => {
  it("prefers fid= over /n/ path for performance stats id", () => {
    expect(normalizeGbpLocationIdInput(BLIND_MAGIC_URL)).toBe("12306432658930552311");
  });

  it("persists full profile URLs for posting resolution", () => {
    expect(persistGbpLocationIdInput(BLIND_MAGIC_URL)).toBe(BLIND_MAGIC_URL);
  });

  it("returns all distinct candidates in priority order", () => {
    expect(gbpLocationIdCandidates(BLIND_MAGIC_URL)).toEqual([
      "12306432658930552311",
      "16551297259505229427",
    ]);
  });

  it("tries /n/ before fid for posting candidates", () => {
    expect(gbpLocationIdPostCandidates(BLIND_MAGIC_URL)).toEqual([
      "16551297259505229427",
      "12306432658930552311",
    ]);
  });

  it("extracts locations/ path segment", () => {
    expect(normalizeGbpLocationIdInput("accounts/1/locations/999888777")).toBe("999888777");
  });

  it("passes through bare numeric ids", () => {
    expect(normalizeGbpLocationIdInput("12306432658930552311")).toBe("12306432658930552311");
  });

  it("does not concatenate digits from full URLs", () => {
    const smashed = "1655129725950522942712306432658930552311";
    expect(normalizeGbpLocationIdInput(BLIND_MAGIC_URL)).not.toBe(smashed);
    expect(gbpLocationIdCandidates(BLIND_MAGIC_URL)).not.toContain(smashed);
  });
});
