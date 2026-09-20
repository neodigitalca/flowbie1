import { describe, expect, it } from "vitest";
import { elementorPageTargetFromInput } from "@/lib/elementor-page-target";

describe("elementorPageTargetFromInput", () => {
  it("treats the site home URL as the front page", () => {
    expect(elementorPageTargetFromInput("https://flowbie.ca/", "https://flowbie.ca")).toEqual({
      kind: "front",
    });
    expect(elementorPageTargetFromInput("https://flowbie.ca", "https://flowbie.ca/")).toEqual({
      kind: "front",
    });
    expect(elementorPageTargetFromInput("", "https://flowbie.ca")).toEqual({ kind: "front" });
  });

  it("keeps a numeric page id", () => {
    expect(elementorPageTargetFromInput("18380")).toEqual({ kind: "id", pageId: 18380 });
  });

  it("uses the full path as slug for nested pages", () => {
    expect(
      elementorPageTargetFromInput("https://flowbie.ca/about/team/", "https://flowbie.ca"),
    ).toEqual({
      kind: "slug",
      slug: "about/team",
    });
    expect(elementorPageTargetFromInput("https://flowbie.ca/about/", "https://flowbie.ca")).toEqual({
      kind: "slug",
      slug: "about",
    });
    expect(elementorPageTargetFromInput("services")).toEqual({ kind: "slug", slug: "services" });
  });
});
