import { REPORT_TEMPERATURE } from "@/lib/competitor-research/competitor-report-openrouter-limits";

const OR = "https://openrouter.ai/api/v1/chat/completions";

export async function callOpenRouterChatCompletion(args: {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  signal?: AbortSignal;
  /** Defaults to REPORT_TEMPERATURE. Use a lower value for structured JSON outputs. */
  temperature?: number;
  /** When set, requests JSON-only output on models that support OpenAI-style response_format. */
  responseFormat?: { type: "json_object" };
}): Promise<{
  raw: unknown;
  content: string;
  finishReason?: string;
  nativeFinishReason?: string;
}> {
  const body: Record<string, unknown> = {
    model: args.model,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.user },
    ],
    temperature: args.temperature ?? REPORT_TEMPERATURE,
    max_tokens: args.maxTokens,
    stream: false,
  };
  if (args.responseFormat) {
    body.response_format = args.responseFormat;
  }

  const res = await fetch(OR, {
    method: "POST",
    signal: args.signal,
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
      "X-Title": "Flowbie",
    },
    body: JSON.stringify(body),
  });

  const j = (await res.json()) as {
    choices?: Array<{
      message?: { content?: string };
      finish_reason?: string;
      native_finish_reason?: string;
    }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    const detail = j.error?.message || JSON.stringify(j);
    throw new Error(`OpenRouter error (${res.status}): ${detail}`);
  }
  const ch0 = j.choices?.[0];
  const content = ch0?.message?.content;
  if (typeof content !== "string") {
    throw new Error(`OpenRouter error (${res.status}): no content`);
  }
  return {
    raw: j,
    content,
    finishReason: ch0?.finish_reason,
    nativeFinishReason: ch0?.native_finish_reason,
  };
}
