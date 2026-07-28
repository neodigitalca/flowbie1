/**
 * OpenRouter completion (`max_tokens`) per research model - conservative caps to avoid 400s
 * and huge stalls; provider may still clamp to the model’s real max.
 */
export const REPORT_PIPELINE_MICRO_TOTAL = 9 as const;

export type ReportPipelineMicroStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** What we POST to OpenRouter - sizes and row counts so the UI can show “what we’re sending”. */
export type CompetitorReportRequestStats = {
  model: string;
  maxTokensRequested: number;
  /** Exact JSON string used as the HTTP body (same bytes as `fetch`). For download / inspection. */
  requestBodyJson: string;
  /** UTF-8 byte length of the full JSON request body (model + messages + params). */
  approxRequestBodyBytes: number;
  systemChars: number;
  userMessageChars: number;
  /** Compact JSON.stringify of context only (same structure as inside the user message, no pretty-print). */
  contextJsonChars: number;
  breakdown: {
    semrushRowCount: number;
    gscQueryCount: number;
    enrichmentDomainCount: number;
    enrichmentTopKeywordRowsTotal: number;
    seedTopKeywordCount: number;
    tierGroupCount: number;
  };
};

export type CompetitorReportMicroStepPayload = {
  step: ReportPipelineMicroStep;
  total: typeof REPORT_PIPELINE_MICRO_TOTAL;
  label: string;
  /** Set when the main report write step runs (immediately before the OpenRouter fetch). */
  requestStats?: CompetitorReportRequestStats;
};

export const REPORT_TEMPERATURE = 0.35;

/** Exact JSON string POSTed to OpenRouter chat/completions (for downloads / debugging). */
export function buildOpenRouterChatPostBodyJson(args: {
  model: string;
  maxTokensRequested: number;
  system: string;
  userMessage: string;
}): string {
  return JSON.stringify({
    model: args.model,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.userMessage },
    ],
    temperature: REPORT_TEMPERATURE,
    max_tokens: args.maxTokensRequested,
    stream: false,
  });
}

/**
 * Mirrors the OpenRouter POST body in `runCompetitorReportAgent` for accurate size measurement.
 */
export function measureCompetitorReportOpenRouterPayload(args: {
  model: string;
  maxTokensRequested: number;
  system: string;
  userMessage: string;
  context: unknown;
  breakdown: CompetitorReportRequestStats["breakdown"];
}): CompetitorReportRequestStats {
  const requestBodyJson = buildOpenRouterChatPostBodyJson({
    model: args.model,
    maxTokensRequested: args.maxTokensRequested,
    system: args.system,
    userMessage: args.userMessage,
  });
  const approxRequestBodyBytes = new TextEncoder().encode(requestBodyJson).length;
  /** Compact JSON (same as wire POST) - not pretty-printed. */
  const contextJsonChars = JSON.stringify(args.context).length;
  return {
    model: args.model,
    maxTokensRequested: args.maxTokensRequested,
    requestBodyJson,
    approxRequestBodyBytes,
    systemChars: args.system.length,
    userMessageChars: args.userMessage.length,
    contextJsonChars,
    breakdown: args.breakdown,
  };
}

/** Absolute ceiling we request for model families that allow very large completions (non-Gemini). */
const REPORT_OUTPUT_MAX_CEILING = 131072;

/**
 * OpenRouter lists ~65.5K max **completion** tokens for Google Gemini 2.5 Flash / Flash Lite / Pro on the
 * model pages. Requesting 131K was misleading in the UI and did not raise the real cap; the model still
 * stops at ~65K, which produced confusing "cut off at 131,072" errors.
 */
export const OPENROUTER_GEMINI_MAX_COMPLETION = 65_536;

/** Default completion cap for unknown models (prefer large window to reduce cutoffs). */
const REPORT_OUTPUT_DEFAULT = 131_072;

/**
 * Map OpenRouter model id to a requested `max_tokens` (completion), bounded by ceiling.
 */
export function getCompetitorReportMaxOutputTokens(modelId: string): number {
  const m = modelId.trim().toLowerCase();

  if (m.includes("gemini-2.5-flash-lite") || m.includes("flash-lite")) {
    return Math.min(OPENROUTER_GEMINI_MAX_COMPLETION, REPORT_OUTPUT_MAX_CEILING);
  }
  if (m.includes("gemini-2.5-flash") || m.includes("gemini-2.5-pro")) {
    return Math.min(OPENROUTER_GEMINI_MAX_COMPLETION, REPORT_OUTPUT_MAX_CEILING);
  }
  if (m.includes("gemini") || m.includes("google/")) {
    return Math.min(OPENROUTER_GEMINI_MAX_COMPLETION, REPORT_OUTPUT_MAX_CEILING);
  }
  if (m.includes("gpt-4") || m.includes("gpt-5") || m.includes("openai/")) {
    return Math.min(32_768, REPORT_OUTPUT_MAX_CEILING);
  }
  if (m.includes("claude")) {
    return Math.min(16_384, REPORT_OUTPUT_MAX_CEILING);
  }

  return Math.min(REPORT_OUTPUT_DEFAULT, REPORT_OUTPUT_MAX_CEILING);
}
