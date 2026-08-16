import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GeneratorToolbarFrame } from "@/components/blog-generator/GeneratorToolbarFrame";
import {
  GENERATOR_FIELD_COUNT,
  GENERATOR_FIELD_KEYWORD,
  GENERATOR_SELECT,
  GENERATOR_TOOLBAR_ACTIONS_CLASS,
  GENERATOR_TOOLBAR_PRIMARY_CLASS,
  GENERATOR_TOOLBAR_ROOT_CLASS,
} from "@/components/blog-generator/generator-toolbar-theme";

describe("generator-toolbar-theme", () => {
  it("exposes fixed-height field and select tokens", () => {
    expect(GENERATOR_FIELD_KEYWORD).toContain("w-[10rem]");
    expect(GENERATOR_FIELD_KEYWORD).toContain("h-8");
    expect(GENERATOR_FIELD_COUNT).toContain("w-[3.25rem]");
    expect(GENERATOR_SELECT).toContain("w-[9rem]");
    expect(GENERATOR_SELECT).toContain("h-8");
  });

  it("exposes three-zone toolbar layout classes", () => {
    expect(GENERATOR_TOOLBAR_ROOT_CLASS).toContain("gap-1.5");
    expect(GENERATOR_TOOLBAR_PRIMARY_CLASS).toContain("flex-1");
    expect(GENERATOR_TOOLBAR_ACTIONS_CLASS).toContain("ml-auto");
  });
});

describe("GeneratorToolbarFrame", () => {
  it("renders primary, options, and actions zones", () => {
    const html = renderToStaticMarkup(
      createElement(GeneratorToolbarFrame, {
        primary: createElement("span", null, "Primary"),
        options: createElement("span", null, "Options"),
        actions: createElement("span", null, "Actions"),
      }),
    );
    expect(html).toContain("Primary");
    expect(html).toContain("Options");
    expect(html).toContain("Actions");
    expect(html).toContain('role="toolbar"');
  });
});
