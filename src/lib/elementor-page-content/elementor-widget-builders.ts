/** Minimal Elementor widget helpers for harness insert operations. */

export function headingWidget(id: string, title: string, headerSize: "h1" | "h2" | "h3") {
  return {
    id,
    elType: "widget",
    widgetType: "heading",
    settings: { title, header_size: headerSize, align: "left" },
    elements: [],
  };
}

export function textEditorWidget(id: string, html: string) {
  return {
    id,
    elType: "widget",
    widgetType: "text-editor",
    settings: { editor: html },
    elements: [],
  };
}

export function innerContainer(id: string, elements: unknown[]) {
  return {
    id,
    elType: "container",
    isInner: true,
    settings: {
      content_width: "full",
      flex_direction: "column",
      padding: { unit: "px", top: "16", right: "24", bottom: "16", left: "24", isLinked: false },
    },
    elements,
  };
}
