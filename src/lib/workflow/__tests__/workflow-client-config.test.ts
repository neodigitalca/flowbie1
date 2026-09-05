import { describe, expect, it } from "vitest";
import {
  resolveWorkflowClientSiteIds,
  workflowClientPublishSummary,
  workflowClientSiteSummary,
} from "@/lib/workflow/workflow-client-config";

describe("workflow-client-config", () => {
  it("returns all available sites when scope is all", () => {
    expect(
      resolveWorkflowClientSiteIds({ siteIds: ["a"], clientScope: "all" }, ["a", "b", "c"]),
    ).toEqual(["a", "b", "c"]);
  });

  it("returns selected site ids when scope is selected", () => {
    expect(
      resolveWorkflowClientSiteIds({ siteIds: ["a", "c"], clientScope: "selected" }, ["a", "b", "c"]),
    ).toEqual(["a", "c"]);
  });

  it("summarizes all clients", () => {
    expect(
      workflowClientSiteSummary(
        { siteIds: [], clientScope: "all" },
        [
          { id: "a", name: "Alpha" },
          { id: "b", name: "Beta" },
        ],
      ),
    ).toBe("All clients (2)");
  });

  it("summarizes selected client count", () => {
    expect(
      workflowClientSiteSummary(
        { siteIds: ["a", "b"], clientScope: "selected" },
        [
          { id: "a", name: "Alpha" },
          { id: "b", name: "Beta" },
        ],
      ),
    ).toBe("2 clients");
  });

  it("summarizes publish day and time", () => {
    expect(
      workflowClientPublishSummary({
        siteIds: ["a"],
        startDate: "2026-09-01",
        time: "07:00",
        dayOfMonth: 1,
      }),
    ).toBe("Publishes 1st at 7:00 AM");
  });

  it("returns null publish summary when startDate is empty", () => {
    expect(workflowClientPublishSummary({ siteIds: ["a"] })).toBeNull();
  });
});
