import { describe, expect, it } from "vitest";
import {
  buildScenarioJsonGeneratedFile,
  buildScenarioRowDisplaySections,
  filterScenarioRowDisplayFiles,
} from "@/lib/overview/overview-blog-scenario-harness-sections";

describe("buildScenarioRowDisplaySections", () => {
  it("always exposes Case scenario, Post content, and WordPress upload rows", () => {
    expect(
      buildScenarioRowDisplaySections([{ status: "generating" }], []).map((section) => section.title),
    ).toEqual(["Case scenario", "Post content", "WordPress upload"]);
  });

  it("marks Case scenario done when harness finishes or scenario.json exists", () => {
    expect(buildScenarioRowDisplaySections([{ status: "done" }], [])[0]?.status).toBe("done");
    expect(
      buildScenarioRowDisplaySections([], [{ name: "scenario.json" }])[0]?.status,
    ).toBe("done");
  });
});

describe("filterScenarioRowDisplayFiles", () => {
  it("keeps scenario.json, content html, and wordpress.json", () => {
    expect(
      filterScenarioRowDisplayFiles([
        { name: "scenario.json", content: "{}" },
        { name: "content-page.html", content: "<p>full</p>" },
        { name: "scenario.html", content: "<h2>" },
        { name: "wordpress.json", content: "{}" },
      ]).map((file) => file.name),
    ).toEqual(["scenario.json", "content-page.html", "wordpress.json"]);
  });
});

describe("buildScenarioJsonGeneratedFile", () => {
  it("writes h2 title and html", () => {
    const file = buildScenarioJsonGeneratedFile({
      h2Title: "West-facing light choices",
      html: "<h2>West-facing light choices</h2><p>Intro</p>",
    });
    expect(file?.name).toBe("scenario.json");
    expect(file?.content).toContain("West-facing light choices");
  });

  it("returns null when html or h2 title is missing", () => {
    expect(buildScenarioJsonGeneratedFile({ h2Title: "", html: "" })).toBeNull();
  });
});
