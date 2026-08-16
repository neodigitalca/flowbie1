import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SocialCreatorInstagramPreview } from "@/components/social/creator/SocialCreatorInstagramPreview";
import type { SocialCreatorRow } from "@/lib/social/social-creator-types";

const row: SocialCreatorRow = {
  id: "preview-row",
  focusKeyword: "preview keyword",
  status: "ready",
  createdAt: "",
  fbInstagramContent: "Short organic caption\n#NEO Pulse",
};

describe("SocialCreatorInstagramPreview", () => {
  it("renders organic preview without Sponsored label or CTA pill", () => {
    const html = renderToStaticMarkup(
      createElement(SocialCreatorInstagramPreview, {
        row,
        caption: row.fbInstagramContent ?? "",
        onCaptionChange: () => undefined,
      }),
    );
    expect(html).not.toContain("Sponsored");
    expect(html).not.toContain("Learn More");
    expect(html).toContain("Short organic caption");
  });
});
