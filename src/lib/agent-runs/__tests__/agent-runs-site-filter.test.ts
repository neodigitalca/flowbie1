import { describe, expect, it } from "vitest";
import {
  AGENT_RUNS_ALL_SITES_ID,
  isAgentsAllSitesFilter,
  resolveDefaultAgentsSiteFilter,
} from "@/lib/agent-runs/agent-runs-site-filter";

describe("agent-runs-site-filter", () => {
  it("defaults to active connected site when available", () => {
    expect(resolveDefaultAgentsSiteFilter("site-a", ["site-a", "site-b"])).toBe("site-a");
  });

  it("falls back to first enabled site", () => {
    expect(resolveDefaultAgentsSiteFilter("missing", ["site-b", "site-c"])).toBe("site-b");
  });

  it("detects all-sites filter mode", () => {
    expect(isAgentsAllSitesFilter(AGENT_RUNS_ALL_SITES_ID)).toBe(true);
    expect(isAgentsAllSitesFilter("site-a")).toBe(false);
  });
});
