import { describe, expect, it } from "vitest";
import { readSuggestKeywordTargetsFromModelContent } from "@/lib/suggest-keyword-targets-schema";

describe("suggest-keyword-targets-schema", () => {
  it("reads clusters from model JSON string", () => {
    const content = JSON.stringify({
      clusters: [
        {
          seedKeyword: "blinds",
          wikiEntityHint: "Area, City, ST",
          sapPagesSeed: 3,
          members: [{ keyword: "custom blinds" }],
        },
      ],
    });
    const data = readSuggestKeywordTargetsFromModelContent(content);
    expect(data.clusters).toHaveLength(1);
    expect(data.clusters[0]!.seedKeyword).toBe("blinds");
  });
});
