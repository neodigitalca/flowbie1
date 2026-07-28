/** OpenRouter JSON schema — Gemini returns this shape; no manual parsing layer. */

export type SuggestKeywordTargetsModelResponse = {
  clusters: Array<{
    clusterId?: string;
    seedKeyword: string;
    wikiEntityHint: string;
    sapPagesSeed: number;
    members: Array<{ keyword: string }>;
  }>;
};

export function suggestKeywordTargetsResponseFormat(minClusters = 1): {
  type: "json_schema";
  json_schema: {
    name: string;
    strict: boolean;
    schema: Record<string, unknown>;
  };
} {
  return {
    type: "json_schema",
    json_schema: {
      name: "suggest_keyword_targets",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["clusters"],
        properties: {
          clusters: {
            type: "array",
            minItems: Math.max(1, Math.floor(minClusters)),
            items: {
              type: "object",
              additionalProperties: false,
              required: ["seedKeyword", "wikiEntityHint", "sapPagesSeed", "members"],
              properties: {
                clusterId: { type: "string" },
                seedKeyword: { type: "string" },
                wikiEntityHint: { type: "string" },
                sapPagesSeed: { type: "integer", minimum: 1 },
                members: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["keyword"],
                    properties: {
                      keyword: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

export function readSuggestKeywordTargetsFromModelContent(content: string): SuggestKeywordTargetsModelResponse {
  const data = JSON.parse(content) as SuggestKeywordTargetsModelResponse;
  if (!Array.isArray(data.clusters) || data.clusters.length === 0) {
    throw new Error("Research model returned no keyword targets.");
  }
  return data;
}
