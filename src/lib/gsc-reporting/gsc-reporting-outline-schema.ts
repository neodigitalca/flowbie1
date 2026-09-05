/** Strict OpenRouter schema for GSC report outline (summary + opportunities only; sections are built in code). */
export const GSC_REPORTING_OUTLINE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    executiveSummary: { type: "string" },
    topOpportunities: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          rank: { type: "number" },
          label: { type: "string" },
          why: { type: "string" },
          metrics: { type: "string" },
          evidence: {
            type: "array",
            maxItems: 3,
            items: { type: "string" },
          },
        },
        required: ["rank", "label", "why", "metrics"],
      },
    },
  },
  required: ["executiveSummary", "topOpportunities"],
} as const;

export const GSC_OUTLINE_OPENROUTER_OPTS = {
  responseFormat: {
    type: "json_schema" as const,
    json_schema: {
      name: "gsc_reporting_outline",
      strict: true,
      schema: GSC_REPORTING_OUTLINE_JSON_SCHEMA,
    },
  },
  temperature: 0.2,
};
