import { describe, expect, it } from "vitest";
import {
  agentRunBucketKey,
  agentRunClientId,
  buildAgentRunGroups,
  buildAgentRunSiteNameMap,
  buildAutoExpandedAgentRunFolderKeys,
  buildAutoExpandedAgentRunClientKeys,
  mergeEnabledSiteClientGroups,
  resolveAgentRunBucketTabSelections,
  AGENT_RUN_UNASSIGNED_CLIENT_ID,
} from "@/lib/agent-runs/agent-run-grouping";
import type { AgentRun } from "@/lib/agent-runs-types";

function makeRun(partial: Partial<AgentRun> = {}): AgentRun {
  return {
    id: 1,
    teamId: 1,
    createdBy: 1,
    title: "Run",
    recipeKey: "",
    recipeTitle: "Content optimizer",
    status: "running",
    source: "task_manager",
    taskId: 0,
    taskTitle: "",
    context: {},
    plan: {},
    result: null,
    errorMessage: "",
    clientBatchKey: "",
    startedAt: null,
    finishedAt: null,
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("agentRunBucketKey", () => {
  it("uses clientRunContract targetBucket", () => {
    const run = makeRun({
      plan: { clientRunContract: { siteId: "site-a", targetBucket: "posts" } as never },
    });
    expect(agentRunBucketKey(run)).toBe("posts");
  });

  it("returns all for scope all", () => {
    const run = makeRun({
      plan: { clientRunContract: { siteId: "site-a", scope: "all", url: "ALL" } as never },
    });
    expect(agentRunBucketKey(run)).toBe("all");
  });

  it("infers pages from resolvedPost subtype page", () => {
    const run = makeRun({
      plan: {
        clientRunContract: {
          siteId: "site-a",
          url: "https://example.com/about",
          resolvedPost: { id: 1, subtype: "page" },
        } as never,
      },
    });
    expect(agentRunBucketKey(run)).toBe("pages");
  });

  it("infers posts from resolvedPost endpoint posts", () => {
    const run = makeRun({
      plan: {
        clientRunContract: {
          siteId: "site-a",
          url: "https://example.com/blog/post",
          resolvedPost: { id: 2, subtype: "post", endpoint: "posts" },
        } as never,
      },
    });
    expect(agentRunBucketKey(run)).toBe("posts");
  });

  it("infers sap from custom endpoint", () => {
    const run = makeRun({
      plan: {
        clientRunContract: {
          siteId: "site-a",
          url: "https://example.com/service-area/foo",
          resolvedPost: { id: 3, subtype: "service-area", endpoint: "service-area" },
        } as never,
      },
    });
    expect(agentRunBucketKey(run)).toBe("sap");
  });

  it("uses context sitemapSource for Pulse Assist runs", () => {
    const run = makeRun({
      context: { sitemapSource: "posts", siteId: "site-a" },
    });
    expect(agentRunBucketKey(run)).toBe("posts");
  });

  it("falls back to other when no bucket metadata", () => {
    expect(agentRunBucketKey(makeRun({ recipeKey: "unknown_recipe" }))).toBe("other");
  });

  it("uses reporting for gsc_reporting recipe", () => {
    const run = makeRun({
      recipeKey: "gsc_reporting",
      plan: {
        clientRunContract: { siteId: "site-a", comparePreset: "mom", saveToDisk: true } as never,
      },
    });
    expect(agentRunBucketKey(run)).toBe("reporting");
  });

  it("uses reporting when comparePreset implies gsc despite wrong recipeKey", () => {
    const run = makeRun({
      recipeKey: "content_optimizer_bulk",
      plan: {
        clientRunContract: { siteId: "site-a", comparePreset: "mom", saveToDisk: true } as never,
      },
    });
    expect(agentRunBucketKey(run)).toBe("reporting");
  });

  it("uses editorial for post_creator recipe", () => {
    const run = makeRun({
      recipeKey: "post_creator",
      plan: { clientRunContract: { siteId: "site-a", postCount: 1 } as never },
    });
    expect(agentRunBucketKey(run)).toBe("editorial");
  });

  it("uses meta for overview_pages_meta_batch recipe", () => {
    const run = makeRun({
      recipeKey: "overview_pages_meta_batch",
      plan: { clientRunContract: { siteId: "site-a" } as never },
    });
    expect(agentRunBucketKey(run)).toBe("meta");
  });

  it("uses dfs_llm_article_audit bucket for dfs_llm_article_audit recipe", () => {
    const run = makeRun({
      recipeKey: "dfs_llm_article_audit",
      plan: { clientRunContract: { siteId: "site-a" } as never },
    });
    expect(agentRunBucketKey(run)).toBe("dfs_llm_article_audit");
  });

  it("keeps dfs_llm_article_audit bucket when resolvedPost is a post", () => {
    const run = makeRun({
      recipeKey: "dfs_llm_article_audit",
      plan: {
        clientRunContract: {
          siteId: "site-a",
          resolvedPost: { endpoint: "posts", subtype: "post" },
        } as never,
      },
    });
    expect(agentRunBucketKey(run)).toBe("dfs_llm_article_audit");
  });

  it("uses meta for content_optimizer_bulk recipe", () => {
    const run = makeRun({
      recipeKey: "content_optimizer_bulk",
      plan: { clientRunContract: { siteId: "site-a" } as never },
    });
    expect(agentRunBucketKey(run)).toBe("meta");
  });

  it("keeps sitemap bucket for content optimizer when recipe is bulk", () => {
    const run = makeRun({
      recipeKey: "content_optimizer_bulk",
      plan: { clientRunContract: { siteId: "site-a", targetBucket: "pages" } as never },
    });
    expect(agentRunBucketKey(run)).toBe("pages");
  });
});

describe("agentRunClientId", () => {
  it("uses contract siteId", () => {
    const run = makeRun({
      plan: { clientRunContract: { siteId: "site-a" } as never },
    });
    expect(agentRunClientId(run)).toBe("site-a");
  });

  it("falls back to unassigned", () => {
    expect(agentRunClientId(makeRun())).toBe(AGENT_RUN_UNASSIGNED_CLIENT_ID);
  });
});

describe("buildAgentRunGroups", () => {
  it("groups runs by client and bucket with sort order", () => {
    const siteNames = buildAgentRunSiteNameMap([
      { id: "site-b", name: "Beta Site" },
      { id: "site-a", name: "Acme Corp" },
    ]);

    const runs = [
      makeRun({ id: 1, context: { siteId: "site-a" }, plan: { clientRunContract: { siteId: "site-a", targetBucket: "posts" } as never } }),
      makeRun({ id: 2, context: { siteId: "site-a" }, plan: { clientRunContract: { siteId: "site-a", targetBucket: "pages" } as never } }),
      makeRun({ id: 3, context: { siteId: "site-b" }, plan: { clientRunContract: { siteId: "site-b", targetBucket: "pages" } as never } }),
      makeRun({ id: 4, context: {}, recipeKey: "unknown_recipe" }),
    ];

    const groups = buildAgentRunGroups(runs, siteNames);

    expect(groups.map((g) => g.label)).toEqual(["Acme Corp", "Beta Site", "Unassigned"]);
    expect(groups[0].buckets.map((b) => b.key)).toEqual(["pages", "posts"]);
    expect(groups[0].buckets[0].runs.map((r) => r.id)).toEqual([2]);
    expect(groups[2].buckets[0].key).toBe("other");
  });

  it("labels gsc runs as Reporting not Other", () => {
    const siteNames = buildAgentRunSiteNameMap([{ id: "site-a", name: "Advance Blinds" }]);
    const runs = [
      makeRun({
        id: 5,
        recipeKey: "gsc_reporting",
        context: { siteId: "site-a" },
        plan: {
          clientRunContract: { siteId: "site-a", comparePreset: "mom", saveToDisk: true } as never,
        },
      }),
    ];
    const groups = buildAgentRunGroups(runs, siteNames);
    expect(groups[0].buckets[0].key).toBe("reporting");
    expect(groups[0].buckets[0].label).toBe("Reporting");
  });
});

describe("buildAutoExpandedAgentRunFolderKeys", () => {
  it("expands folders for active and selected runs", () => {
    const runs = [
      makeRun({
        id: 10,
        status: "running",
        plan: { clientRunContract: { siteId: "site-a", targetBucket: "pages" } as never },
      }),
      makeRun({
        id: 11,
        status: "done",
        plan: { clientRunContract: { siteId: "site-b", targetBucket: "posts" } as never },
      }),
    ];

    const keys = buildAutoExpandedAgentRunFolderKeys(runs, 11);
    expect(keys.has("client:site-a")).toBe(true);
    expect(keys.has("bucket:site-a:pages")).toBe(true);
    expect(keys.has("client:site-b")).toBe(true);
    expect(keys.has("bucket:site-b:posts")).toBe(true);
  });
});

describe("resolveAgentRunBucketTabSelections", () => {
  const siteNames = buildAgentRunSiteNameMap([{ id: "site-a", name: "Advance Blinds" }]);

  function groupsFor(runs: AgentRun[]) {
    return buildAgentRunGroups(runs, siteNames);
  }

  it("defaults to first bucket when user has not picked a tab", () => {
    const runs = [
      makeRun({
        id: 1,
        status: "running",
        recipeKey: "local_dominator_export",
        plan: { clientRunContract: { siteId: "site-a" } as never },
      }),
      makeRun({
        id: 2,
        status: "done",
        plan: { clientRunContract: { siteId: "site-a", targetBucket: "other" } as never },
      }),
    ];
    const groups = groupsFor(runs);
    const selections = resolveAgentRunBucketTabSelections(groups);
    expect(selections["site-a"]).toBe("research");
  });

  it("keeps user pick when that bucket has no runs", () => {
    const runs = [
      makeRun({
        id: 1,
        status: "running",
        recipeKey: "local_dominator_export",
        plan: { clientRunContract: { siteId: "site-a" } as never },
      }),
      makeRun({
        id: 2,
        status: "done",
        plan: { clientRunContract: { siteId: "site-a" } as never },
      }),
    ];
    const groups = groupsFor(runs);
    const selections = resolveAgentRunBucketTabSelections(groups, {
      "site-a": "other",
    });
    expect(selections["site-a"]).toBe("other");
  });

  it("keeps user pick when another bucket has an active run", () => {
    const runs = [
      makeRun({
        id: 1,
        status: "running",
        recipeKey: "local_dominator_export",
        plan: { clientRunContract: { siteId: "site-a" } as never },
      }),
      makeRun({
        id: 2,
        status: "running",
        recipeKey: "post_creator",
        plan: { clientRunContract: { siteId: "site-a" } as never },
      }),
    ];
    const groups = groupsFor(runs);
    const selections = resolveAgentRunBucketTabSelections(groups, {
      "site-a": "editorial",
    });
    expect(selections["site-a"]).toBe("editorial");
  });

  it("keeps user pick when that bucket still has runs", () => {
    const runs = [
      makeRun({
        id: 1,
        status: "done",
        plan: { clientRunContract: { siteId: "site-a", targetBucket: "posts" } as never },
      }),
      makeRun({
        id: 2,
        status: "done",
        plan: { clientRunContract: { siteId: "site-a", targetBucket: "pages" } as never },
      }),
    ];
    const groups = groupsFor(runs);
    const selections = resolveAgentRunBucketTabSelections(groups, {
      "site-a": "posts",
    });
    expect(selections["site-a"]).toBe("posts");
  });

  it("keeps empty user pick instead of switching to a bucket with runs", () => {
    const runs = [
      makeRun({
        id: 1,
        status: "running",
        recipeKey: "dfs_llm_article_audit",
        plan: { clientRunContract: { siteId: "site-a" } as never },
      }),
    ];
    const groups = groupsFor(runs);
    const selections = resolveAgentRunBucketTabSelections(groups, {
      "site-a": "reporting",
    });
    expect(selections["site-a"]).toBe("reporting");
  });

  it("defaults empty client to reporting tab", () => {
    const siteNameById = new Map([["site-a", "Alpha"]]);
    const merged = mergeEnabledSiteClientGroups(["site-a"], [], siteNameById);
    const selections = resolveAgentRunBucketTabSelections(merged);
    expect(selections["site-a"]).toBe("reporting");
  });

  it("preserves user tab pick", () => {
    const runs = [
      makeRun({
        id: 1,
        status: "done",
        plan: { clientRunContract: { siteId: "site-a", targetBucket: "pages" } as never },
      }),
      makeRun({
        id: 2,
        status: "done",
        plan: { clientRunContract: { siteId: "site-a", targetBucket: "posts" } as never },
      }),
    ];
    const groups = groupsFor(runs);
    const selections = resolveAgentRunBucketTabSelections(groups, {
      "site-a": "posts",
    });
    expect(selections["site-a"]).toBe("posts");
  });
});

describe("buildAutoExpandedAgentRunClientKeys", () => {
  it("expands client folders only for active and selected runs", () => {
    const runs = [
      makeRun({
        id: 10,
        status: "running",
        plan: { clientRunContract: { siteId: "site-a", targetBucket: "pages" } as never },
      }),
      makeRun({
        id: 11,
        status: "done",
        plan: { clientRunContract: { siteId: "site-b", targetBucket: "posts" } as never },
      }),
    ];

    const keys = buildAutoExpandedAgentRunClientKeys(runs, 11);
    expect(keys.has("client:site-a")).toBe(true);
    expect(keys.has("client:site-b")).toBe(true);
    expect([...keys].some((k) => k.startsWith("bucket:"))).toBe(false);
  });
});

describe("mergeEnabledSiteClientGroups", () => {
  it("includes every enabled site even when no runs exist", () => {
    const siteNameById = new Map([
      ["site-a", "Alpha"],
      ["site-b", "Beta"],
    ]);
    const runGroups = buildAgentRunGroups(
      [
        makeRun({
          id: 1,
          plan: { clientRunContract: { siteId: "site-a", targetBucket: "pages" } as never },
        }),
      ],
      siteNameById,
    );

    const merged = mergeEnabledSiteClientGroups(["site-a", "site-b"], runGroups, siteNameById);

    expect(merged.map((g) => g.siteId)).toEqual(["site-a", "site-b"]);
    const empty = merged.find((g) => g.siteId === "site-b");
    expect(empty?.runCount).toBe(0);
    expect(empty?.buckets).toEqual([]);
  });

  it("appends unassigned runs after enabled sites", () => {
    const siteNameById = new Map([["site-a", "Alpha"]]);
    const runGroups = buildAgentRunGroups(
      [
        makeRun({
          id: 2,
          plan: { clientRunContract: { siteId: AGENT_RUN_UNASSIGNED_CLIENT_ID, targetBucket: "pages" } as never },
        }),
      ],
      siteNameById,
    );

    const merged = mergeEnabledSiteClientGroups(["site-a"], runGroups, siteNameById);

    expect(merged.some((g) => g.siteId === AGENT_RUN_UNASSIGNED_CLIENT_ID)).toBe(true);
  });
});
