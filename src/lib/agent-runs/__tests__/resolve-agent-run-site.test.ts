import { describe, expect, it } from "vitest";
import type { WordPressSite } from "@/components/integrations/types";
import type { AgentRun } from "@/lib/agent-runs-types";
import {
  resolveAgentRunSiteIds,
  resolveAgentRunWordPressSite,
  resolveGscReportingSite,
} from "@/lib/agent-runs/resolve-agent-run-site";

function site(id: string, name: string): WordPressSite {
  return { id, name, siteUrl: `https://${id}.example` } as WordPressSite;
}

function run(partial: Partial<AgentRun>): AgentRun {
  return {
    id: 1489,
    teamId: 1,
    recipeKey: "gsc_reporting",
    status: "running",
    context: {},
    ...partial,
  } as AgentRun;
}

describe("resolveAgentRunSiteIds", () => {
  it("prefers the agent context site over contract", () => {
    const ids = resolveAgentRunSiteIds(
      run({
        context: { siteId: "ridgeline" },
        plan: {
          clientRunContract: { siteId: "header-site" } as never,
          executionPayload: { siteId: "ridgeline" } as never,
        },
      }),
    );
    expect(ids[0]).toBe("ridgeline");
    expect(ids).toContain("header-site");
  });

  it("reads payload site when context is empty", () => {
    expect(
      resolveAgentRunSiteIds(
        run({
          context: {},
          plan: { executionPayload: { wordpressSiteId: "ridgeline" } as never },
        }),
      ),
    ).toEqual(["ridgeline"]);
  });
});

describe("resolveAgentRunWordPressSite", () => {
  it("resolves the workflow client from the connected sites list", () => {
    const ridgeline = site("ridgeline", "Ridgeline Solar");
    const found = resolveAgentRunWordPressSite(
      run({ context: { siteId: "ridgeline" } }),
      [site("other", "Other"), ridgeline],
    );
    expect(found).toBe(ridgeline);
  });

  it("uses payload site when context id is not in the connected list", () => {
    const ridgeline = site("ridgeline", "Ridgeline Solar");
    const found = resolveAgentRunWordPressSite(
      run({
        context: { siteId: "stale-header" },
        plan: { executionPayload: { siteId: "ridgeline" } as never },
      }),
      [ridgeline],
    );
    expect(found.id).toBe("ridgeline");
  });

  it("does not require a header active site", () => {
    expect(() =>
      resolveAgentRunWordPressSite(run({ context: {} }), [site("ridgeline", "Ridgeline Solar")]),
    ).toThrow(/WordPress site not found for this task/);
  });
});

describe("resolveGscReportingSite", () => {
  it("uses a connected row when the agent already has that site", () => {
    const ridgeline = site("ridgeline", "Ridgeline Solar");
    expect(resolveGscReportingSite(run({ context: { siteId: "ridgeline" } }), [ridgeline])).toBe(ridgeline);
  });

  it("does not fail when no WordPress row exists", () => {
    const stub = resolveGscReportingSite(
      run({
        context: { siteId: "ridgeline" },
        plan: { executionPayload: { businessName: "Ridgeline Solar", siteUrl: "https://ridgelinesolar.ca" } as never },
      }),
      [],
    );
    expect(stub.name).toBe("Ridgeline Solar");
    expect(stub.siteUrl).toBe("https://ridgelinesolar.ca");
  });

  it("uses the connected client row by name when the run has no site id", () => {
    const ridgeline = site("ridgeline", "Ridgeline Solar");
    expect(
      resolveGscReportingSite(
        run({
          context: {},
          plan: { executionPayload: { businessName: "Ridgeline Solar" } as never },
        }),
        [ridgeline],
      ),
    ).toBe(ridgeline);
  });

  it("uses productionSiteUrl from the connected client when siteUrl is empty", () => {
    const ridgeline = {
      ...site("ridgeline", "Ridgeline Solar"),
      siteUrl: "",
      productionSiteUrl: "https://ridgelinesolar.ca",
    };
    const found = resolveGscReportingSite(run({ context: { siteId: "ridgeline" } }), [ridgeline]);
    expect(found).toBe(ridgeline);
    expect(found.productionSiteUrl).toBe("https://ridgelinesolar.ca");
  });
});
