import { describe, expect, it } from "vitest";
import {
  filterAutomationRecipesClient,
  mergeFilterOptions,
} from "@/lib/automation-recipes-filters";
import {
  isAutomationTemplate,
  setAutomationRecipeKeywords,
} from "@/lib/task-automation-templates";
import type { AutomationRecipeCatalogItem } from "@/lib/automation-recipes-types";

const sampleRecipes: AutomationRecipeCatalogItem[] = [
  {
    keyword: "entity-sap-guardian",
    name: "Entity SAP Guardian",
    description: "Entity pages when rankings slip.",
    isAutomation: true,
    category: "local-seo",
    verticals: ["local-seo", "home-services"],
    tags: ["sap"],
    prerequisites: ["gsc", "wordpress"],
    filters: {
      executionKinds: ["content_optimizer"],
      targetBuckets: ["sap"],
      triggerSignals: ["position_drop"],
      actionCount: 1,
    },
  },
  {
    keyword: "posts-ctr-rescue",
    name: "Posts CTR Rescue",
    description: "Posts when CTR drops.",
    isAutomation: true,
    category: "reactive",
    verticals: ["editorial"],
    tags: ["posts"],
    prerequisites: ["gsc", "wordpress"],
    filters: {
      executionKinds: ["content_optimizer"],
      targetBuckets: ["posts"],
      triggerSignals: ["ctr_drop"],
      actionCount: 1,
    },
  },
];

describe("automation-recipes-filters", () => {
  it("filters by bucket and search query", () => {
    const filtered = filterAutomationRecipesClient(sampleRecipes, {
      bucket: "sap",
      q: "entity",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.keyword).toBe("entity-sap-guardian");
  });

  it("filters by execution kind", () => {
    const filtered = filterAutomationRecipesClient(sampleRecipes, {
      execution: "full-aiseo",
    });
    expect(filtered).toHaveLength(2);
  });

  it("merges filter options from recipes", () => {
    const merged = mergeFilterOptions(
      { categories: [], verticals: [], buckets: [], signals: [] },
      sampleRecipes,
    );
    expect(merged.categories).toContain("local-seo");
    expect(merged.buckets).toContain("sap");
    expect(merged.signals).toContain("ctr_drop");
  });
});

describe("task-automation-templates", () => {
  it("detects catalog keywords", () => {
    setAutomationRecipeKeywords(["entity-sap-guardian"]);
    expect(isAutomationTemplate("entity-sap-guardian")).toBe(true);
    expect(isAutomationTemplate("seo-campaign")).toBe(false);
  });

  it("detects trigger-shaped custom templates", () => {
    expect(
      isAutomationTemplate("custom", {
        defaultTasks: [{ keyword: "a", title: "A", scheduleMode: "trigger" }],
      }),
    ).toBe(true);
  });
});
