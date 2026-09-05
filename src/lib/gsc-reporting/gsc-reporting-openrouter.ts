import { REPORT_TEMPERATURE } from "@/lib/competitor-research/competitor-report-openrouter-limits";
import { postOpenRouterAppChat, type OpenRouterAppResponseFormat } from "@/lib/openrouter-app-api";

/** GSC reporting LLM calls use the shared OpenRouter proxy (schema-aware), not a separate GSC route. */
export async function callGscReportingOpenRouterChatCompletion(args: {
  apiKey?: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  signal?: AbortSignal;
  temperature?: number;
  responseFormat?: OpenRouterAppResponseFormat;
}): Promise<{
  raw: unknown;
  content: string;
  finishReason?: string;
  nativeFinishReason?: string;
}> {
  return postOpenRouterAppChat({
    apiKey: args.apiKey,
    model: args.model,
    system: args.system,
    user: args.user,
    maxTokens: args.maxTokens,
    signal: args.signal,
    temperature: args.temperature ?? REPORT_TEMPERATURE,
    responseFormat: args.responseFormat,
  });
}
