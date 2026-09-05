import { backendApiUrl } from "@/lib/wordpress-api/connection";
import type { LlmAuditPlatform } from "@/lib/llm-audit/llm-audit-dataforseo";

export type DataForSeoLlmResponsesLiveParams = {
  platform: LlmAuditPlatform;
  model_name: string;
  user_prompt: string;
  system_message?: string;
  message_chain?: Array<{ role: "user"; message: string }>;
  web_search?: boolean;
  force_web_search?: boolean;
  web_search_country_iso_code?: string;
  web_search_city?: string;
  max_output_tokens?: number;
};

function parseJsonOrThrowHtml(text: string, status: number): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("<!DOCTYPE") || trimmed.startsWith("<html")) {
    throw new Error(
      `LLM audit API returned HTML instead of JSON (HTTP ${status}). Restart dev server so /api/dataforseo/llm-responses-live hits DataForSEO directly.`,
    );
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new Error(`LLM audit API returned non-JSON (HTTP ${status})`);
  }
}

/** Direct DataForSEO LLM Responses Live via backend (not MCP tool registry). */
export async function dataforseoLlmResponsesLive(
  params: DataForSeoLlmResponsesLiveParams,
): Promise<unknown> {
  const res = await fetch(backendApiUrl("/dataforseo/llm-responses-live"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const text = await res.text();
  const json = parseJsonOrThrowHtml(text, res.status);

  if (!res.ok) {
    const msg =
      json && typeof json === "object" && "error" in json
        ? String((json as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new Error(msg);
  }

  if (json && typeof json === "object") {
    const obj = json as Record<string, unknown>;
    if (typeof obj.error === "string" && obj.error.trim() && !Array.isArray(obj.tasks)) {
      throw new Error(obj.error.trim());
    }
  }

  return json;
}
