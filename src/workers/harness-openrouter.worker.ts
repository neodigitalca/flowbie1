/// <reference lib="webworker" />

import { streamOpenRouterChatCompletionCore } from '../lib/openrouter-stream-chat-core';
import type { HarnessOpenRouterWorkerPayload } from '../lib/bulk/harness-openrouter-payload';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<HarnessOpenRouterWorkerPayload>) => {
  const data = e.data;
  void (async () => {
    try {
      const result = await streamOpenRouterChatCompletionCore({
        apiKey: data.apiKey,
        model: data.model,
        messages: data.messages,
        temperature: data.temperature,
        maxTokens: data.maxTokens,
        topP: data.topP,
        httpReferer: data.httpReferer,
        onContentChunk: () => {},
        onFinishReason: () => {},
      });
      ctx.postMessage({
        type: 'done' as const,
        sectionIndex: data.sectionIndex,
        content: result.content,
        finishReason: result.finishReason,
      });
    } catch (err) {
      ctx.postMessage({
        type: 'error' as const,
        sectionIndex: data.sectionIndex,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  })();
};
