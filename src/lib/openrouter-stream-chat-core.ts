/**
 * Worker-safe OpenRouter streaming chat (no window/document).
 * Shared by main-thread api.ts and harness Web Workers.
 */

import { OPENROUTER_WEB_APP_TITLE } from '@/lib/openrouter-attribution';

const CONTEXT_LIMIT = 2_000_000;
const RESERVED_FOR_INPUT = 200_000;
const MAX_OUTPUT_TOKENS = 65_536;

export type OpenRouterChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export function clampOpenRouterMaxTokens(maxTokens: number): number {
  return Math.max(1, Math.min(maxTokens, CONTEXT_LIMIT - RESERVED_FOR_INPUT, MAX_OUTPUT_TOKENS));
}

export interface StreamOpenRouterCoreParams {
  apiKey: string;
  model: string;
  messages: OpenRouterChatMessage[];
  temperature: number;
  maxTokens: number;
  topP: number;
  /** HTTP-Referer header (OpenRouter); main thread passes origin when available. */
  httpReferer: string;
  signal?: AbortSignal;
  onContentChunk: (chunk: string) => void;
  onFinishReason?: (reason: string) => void;
}

export async function streamOpenRouterChatCompletionCore({
  apiKey,
  model,
  messages,
  temperature,
  maxTokens,
  topP,
  httpReferer,
  signal,
  onContentChunk,
  onFinishReason,
}: StreamOpenRouterCoreParams): Promise<{ content: string; isGenerating: boolean; finishReason?: string }> {
  let fullContent = '';
  let lastFinishReason: string | null = null;

  const safeMaxTokens = clampOpenRouterMaxTokens(maxTokens);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': httpReferer,
      'X-Title': OPENROUTER_WEB_APP_TITLE,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: safeMaxTokens,
      top_p: topP,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    try {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.statusText} (${response.status}). Body: ${errorText}`);
    } catch {
      throw new Error(`API Error: ${response.statusText} (${response.status})`);
    }
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Failed to get response reader for streaming.');
  }

  const decoder = new TextDecoder('utf-8');

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);

    for (const line of chunk.split('\n')) {
      if (line.startsWith('data: ')) {
        const data = line.substring(6).trim();
        if (data === '[DONE]') {
          continue;
        }

        try {
          const json = JSON.parse(data);
          const contentChunk = json.choices[0]?.delta?.content;
          const finishReason = json.choices[0]?.finish_reason;

          if (contentChunk) {
            fullContent += contentChunk;
            onContentChunk(contentChunk);
          }

          if (finishReason) {
            lastFinishReason = finishReason;
            onFinishReason?.(finishReason);
          }
        } catch (e) {
          console.error('Error parsing streaming chunk:', e);
        }
      }
    }
  }

  return {
    content: fullContent.trim(),
    isGenerating: false,
    finishReason: lastFinishReason || undefined,
  };
}
