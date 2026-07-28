/**
 * One-shot OpenRouter multimodal chat (vision) with JSON-shaped replies.
 */

export type OpenRouterVisionContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type OpenRouterVisionMessage = {
  role: "system" | "user" | "assistant";
  content: string | OpenRouterVisionContentPart[];
};

export async function openRouterVisionChatCompletion(params: {
  apiKey: string;
  model: string;
  messages: OpenRouterVisionMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = params.apiKey.trim();
  if (!apiKey) throw new Error("OpenRouter API key not found");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://flowbie.app",
      "X-Title": "Flowbie Local Image",
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.2,
      max_tokens: params.maxTokens ?? 2000,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter vision error ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenRouter vision returned empty content");
  }
  return content.trim();
}

export function parseJsonObjectFromModelText(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = trimmed.slice(start, end + 1);
    const parsed = JSON.parse(slice) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  }
  throw new Error("Model reply was not a JSON object");
}
