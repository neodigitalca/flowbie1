import { describe, expect, it } from "vitest";
import { parseUrlOptimizerAgentBatchJson } from "@/lib/url-optimizer/url-optimizer-parse";

describe("parseUrlOptimizerAgentBatchJson", () => {
  it("returns empty array for empty or whitespace content", () => {
    expect(parseUrlOptimizerAgentBatchJson("")).toEqual([]);
    expect(parseUrlOptimizerAgentBatchJson("   ")).toEqual([]);
  });

  it("parses proposals object without throwing", () => {
    const json = JSON.stringify({
      proposals: [
        {
          page: "https://example.com/2020/01/01/old-slug/",
          proposedPrimaryKeyword: "cdap advisor",
          rationale: "Shorter slug",
        },
      ],
    });
    const out = parseUrlOptimizerAgentBatchJson(json);
    expect(out).toHaveLength(1);
    expect(out[0]?.proposedPrimaryKeyword).toBe("cdap advisor");
  });

  it("handles markdown fences and trailing junk", () => {
    const wrapped = `\`\`\`json
{"proposals":[{"page":"https://example.com/a/","proposedPrimaryKeyword":"topic guide","rationale":"ok"}]}
\`\`\`
extra text`;
    expect(parseUrlOptimizerAgentBatchJson(wrapped)).toHaveLength(1);
  });

  it("returns empty array for invalid JSON instead of throwing", () => {
    expect(parseUrlOptimizerAgentBatchJson("{")).toEqual([]);
    expect(parseUrlOptimizerAgentBatchJson("not json")).toEqual([]);
  });
});
