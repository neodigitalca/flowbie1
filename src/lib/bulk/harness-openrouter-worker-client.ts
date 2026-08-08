import type { Message } from '@/lib/api';
import { streamChatCompletion } from '@/lib/api';
import type { HarnessOpenRouterWorkerPayload } from '@/lib/bulk/harness-openrouter-payload';
import { resolveOpenRouterWebReferer } from '@/lib/openrouter-attribution';

export type { HarnessOpenRouterWorkerPayload };

export function resolveHarnessHttpReferer(): string {
  return resolveOpenRouterWebReferer();
}

/**
 * One streaming OpenRouter harness section: dedicated module worker when available,
 * otherwise parallel main-thread streamChatCompletion (e.g. Vitest / no Worker).
 */
export async function runHarnessOpenRouterSection(
  payload: HarnessOpenRouterWorkerPayload,
): Promise<{ content: string; finishReason?: string }> {
  if (typeof Worker === 'undefined') {
    let buf = '';
    let finishReason: string | undefined;
    const result = await streamChatCompletion({
      apiKey: payload.apiKey,
      model: payload.model,
      messages: payload.messages as Message[],
      temperature: payload.temperature,
      maxTokens: payload.maxTokens,
      topP: payload.topP,
      onContentChunk: (c) => {
        buf += c;
      },
      onFinishReason: (r) => {
        finishReason = r;
      },
    });
    return { content: result.content || buf, finishReason: result.finishReason ?? finishReason };
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../../workers/harness-openrouter.worker.ts', import.meta.url), {
      type: 'module',
    });

    const cleanup = () => {
      worker.removeEventListener('message', onMsg);
      worker.removeEventListener('error', onErr);
      worker.terminate();
    };

    const onMsg = (ev: MessageEvent) => {
      const d = ev.data as
        | { type: 'done'; sectionIndex: number; content: string; finishReason?: string }
        | { type: 'error'; sectionIndex: number; message: string };
      if (d.type === 'done' && d.sectionIndex === payload.sectionIndex) {
        cleanup();
        resolve({ content: d.content, finishReason: d.finishReason });
      }
      if (d.type === 'error' && d.sectionIndex === payload.sectionIndex) {
        cleanup();
        reject(new Error(d.message));
      }
    };

    const onErr = (e: ErrorEvent) => {
      cleanup();
      reject(new Error(e.message || 'Harness OpenRouter worker failed'));
    };

    worker.addEventListener('message', onMsg);
    worker.addEventListener('error', onErr);
    worker.postMessage(payload);
  });
}
