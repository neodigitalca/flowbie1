import { describe, expect, it } from "vitest";
import { mapFeatureToInstruction } from "@/lib/feature-mapping";

describe("mapFeatureToInstruction [IMAGE]", () => {
  it("maps markdown image feature to HTML img embed instruction", () => {
    const url = "https://example.com/wp-content/uploads/2024/dental-crowns.png";
    const out = mapFeatureToInstruction(`[IMAGE]: ![dental crowns guide](${url})`, "html");
    expect(out).toContain("<figure");
    expect(out).toContain("<img");
    expect(out).toMatch(/NEVER use <a href/i);
  });

  it("maps markdown image feature to markdown embed instruction", () => {
    const url = "https://example.com/wp-content/uploads/x.png";
    const out = mapFeatureToInstruction(`[IMAGE]: ![alt text](${url})`, "markdown");
    expect(out).toContain(`![alt text](${url})`);
    expect(out).toMatch(/NEVER use \[text\]/i);
  });
});
