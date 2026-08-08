import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";
import { openRouterWebAppHeaders, resolveOpenRouterWebReferer } from "@/lib/openrouter-attribution";
import { clampOpenRouterMaxTokens, streamOpenRouterChatCompletionCore } from "@/lib/openrouter-stream-chat-core";

interface GenerationResult {
  plan: string;
  draft: string;
  final: string;
  currentStage: 'idle' | 'planning' | 'plan_approval_pending' | 'drafting' | 'reviewing' | 'complete' | 'error';
  isGenerating: boolean;
  planApproved?: boolean;
}

interface ChatCompletionRequest {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  signal?: AbortSignal;
}

const OPENROUTER_API_KEY_STORAGE_KEY = "openrouter-api-key";
const DATAFORSEO_API_KEY_STORAGE_KEY = "dataforseo-api-key";
const AGENTMAIL_API_KEY_STORAGE_KEY = "agentmail-api-key";
const AGENTMAIL_GENERAL_EMAIL_STORAGE_KEY = "agentmail-general-email";
const HARDCODED_AGENTMAIL_API_KEY = "am_us_6335fbc83ea1cc86d1690a72cef8f85f1c5a649123f8b5cdf90be15504f2ed8c";
/** Local Vite dev only; production build uses flowbie@ for deployed UI. */
const HARDCODED_AGENTMAIL_GENERAL_EMAIL = import.meta.env.DEV
  ? "seowithflo@agentmail.to"
  : "flowbie@agentmail.to";
const SLACK_BOT_TOKEN_STORAGE_KEY = "slack-bot-token";
const SLACK_GLOBAL_SETTINGS_STORAGE_KEY = "slack-global-settings";

export const loadApiKey = () => {
    return localStorage.getItem(OPENROUTER_API_KEY_STORAGE_KEY) || "";
};

export const saveApiKey = (key: string) => {
    if (key) {
        localStorage.setItem(OPENROUTER_API_KEY_STORAGE_KEY, key);
    } else {
        localStorage.removeItem(OPENROUTER_API_KEY_STORAGE_KEY);
    }
};

export const loadDataForSEOApiKey = () => {
    return localStorage.getItem(DATAFORSEO_API_KEY_STORAGE_KEY) || "";
};

export const saveDataForSEOApiKey = (key: string) => {
    if (key) {
        localStorage.setItem(DATAFORSEO_API_KEY_STORAGE_KEY, key);
    } else {
        localStorage.removeItem(DATAFORSEO_API_KEY_STORAGE_KEY);
    }
};

export const loadAgentMailApiKey = () => {
    return localStorage.getItem(AGENTMAIL_API_KEY_STORAGE_KEY) || HARDCODED_AGENTMAIL_API_KEY;
};

export const saveAgentMailApiKey = (key: string) => {
    if (key) {
        localStorage.setItem(AGENTMAIL_API_KEY_STORAGE_KEY, key);
    } else {
        localStorage.removeItem(AGENTMAIL_API_KEY_STORAGE_KEY);
    }
};

export const loadAgentMailGeneralEmail = () => {
    return localStorage.getItem(AGENTMAIL_GENERAL_EMAIL_STORAGE_KEY) || HARDCODED_AGENTMAIL_GENERAL_EMAIL;
};

export const saveAgentMailGeneralEmail = (email: string) => {
    const t = (email || "").trim();
    if (t) {
        localStorage.setItem(AGENTMAIL_GENERAL_EMAIL_STORAGE_KEY, t);
    } else {
        localStorage.removeItem(AGENTMAIL_GENERAL_EMAIL_STORAGE_KEY);
    }
};

/** Persist OpenRouter + AgentMail keys to the API server so the embedded email poller can run (localStorage alone is not visible to the server). */
export async function syncEmailWorkerKeysToServer(partial: {
  agentmailApiKey?: string;
  openRouterApiKey?: string;
}): Promise<void> {
  const base = (BACKEND_API_BASE || "").replace(/\/$/, "");
  const path = "/api/integrations/sync-email-worker-keys";
  const url = base ? `${base}${path}` : path;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(partial),
    });
    if (!res.ok) {
      console.warn("[Email worker keys] Server sync failed:", res.status);
    }
  } catch (e) {
    console.warn("[Email worker keys] Server sync error:", e);
  }
}

export interface SlackGlobalSettings {
  /** Slack API → App Credentials → App ID */
  slackAppId?: string;
  /** Optional copy of "Date of App Creation" from the Slack app page. */
  appCreatedAt?: string;
  /** App Credentials → Client ID (OAuth). */
  clientId?: string;
  /** App Credentials → Client Secret (sensitive). */
  clientSecret?: string;
  /** App Credentials → Signing Secret (Events API; prefer env in production). */
  signingSecret?: string;
  /** Deprecated by Slack; optional legacy verification. */
  verificationToken?: string;
  /** From auth.test or manual label. */
  workspaceLabel?: string;
  /** When false, Flowbie does not send Slack messages. Default true when unset. */
  notificationsEnabled?: boolean;
  /** Fallback channel when a site has no channel ID. */
  defaultChannelId?: string;
  /** Prepended to outbound messages (e.g. [Flowbie][prod]). */
  messagePrefix?: string;
  /** Mirror Slack → OAuth & Permissions → Redirect URLs (paste the same into Slack). */
  redirectUrls?: string[];
}

function defaultSlackGlobalSettings(): SlackGlobalSettings {
  return {
    notificationsEnabled: true,
    messagePrefix: "",
    defaultChannelId: "",
    slackAppId: "",
    appCreatedAt: "",
    clientId: "",
    clientSecret: "",
    signingSecret: "",
    verificationToken: "",
    workspaceLabel: "",
    redirectUrls: [],
  };
}

export const loadSlackBotToken = (): string => {
  try {
    return localStorage.getItem(SLACK_BOT_TOKEN_STORAGE_KEY) || "";
  } catch {
    return "";
  }
};

export const saveSlackBotToken = (key: string) => {
  if (key) {
    localStorage.setItem(SLACK_BOT_TOKEN_STORAGE_KEY, key);
  } else {
    localStorage.removeItem(SLACK_BOT_TOKEN_STORAGE_KEY);
  }
};

export const loadSlackGlobalSettings = (): SlackGlobalSettings => {
  try {
    const raw = localStorage.getItem(SLACK_GLOBAL_SETTINGS_STORAGE_KEY);
    if (!raw) return defaultSlackGlobalSettings();
    const parsed = JSON.parse(raw) as Partial<SlackGlobalSettings>;
    const merged = { ...defaultSlackGlobalSettings(), ...parsed };
    if (!Array.isArray(merged.redirectUrls)) {
      merged.redirectUrls = [];
    } else {
      merged.redirectUrls = merged.redirectUrls.filter((u) => typeof u === "string");
    }
    return merged;
  } catch {
    return defaultSlackGlobalSettings();
  }
};

export const saveSlackGlobalSettings = (partial: Partial<SlackGlobalSettings>) => {
  const next = { ...loadSlackGlobalSettings(), ...partial };
  try {
    localStorage.setItem(SLACK_GLOBAL_SETTINGS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
};

export const streamGeneration = async ({
  apiKey,
  model,
  systemPrompt,
  userPrompt,
  temperature,
  maxTokens,
  topP,
  onContentChunk,
  signal,
}: ChatCompletionRequest & { onContentChunk: (chunk: string) => void }): Promise<{ content: string; isGenerating: boolean }> => {
  // Temporary variable to collect the full response content
  let fullContent = "";
  let lastFinishReason: string | null = null;

  const safeMaxTokens = clampOpenRouterMaxTokens(maxTokens);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: openRouterWebAppHeaders(apiKey),
    body: JSON.stringify({
      model: model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: temperature,
      max_tokens: safeMaxTokens,
      top_p: topP,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    // Attempt to read the error body if it's not a generic network error
    try {
      let errorText = '';
      let errorJson: any = null;
      
      // Try to parse as JSON first (OpenRouter returns JSON errors)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          errorJson = await response.json();
          errorText = JSON.stringify(errorJson, null, 2);
        } catch {
          errorText = await response.text();
        }
      } else {
        errorText = await response.text();
      }
      
      // Extract meaningful error message
      let errorMessage = `API Error: ${response.statusText} (${response.status})`;
      if (errorJson) {
        if (errorJson.error?.message) {
          errorMessage += `\n\n${errorJson.error.message}`;
        }
        if (errorJson.error?.code) {
          errorMessage += `\nError Code: ${errorJson.error.code}`;
        }
        if (errorJson.error?.type) {
          errorMessage += `\nError Type: ${errorJson.error.type}`;
        }
      } else if (errorText) {
        errorMessage += `\n\n${errorText}`;
      }
      
      throw new Error(errorMessage);
    } catch (err) {
      if (err instanceof Error && err.message.includes('API Error')) {
        throw err;
      }
      throw new Error(`API Error: ${response.statusText} (${response.status})`);
    }
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Failed to get response reader for streaming.");
  }

  const decoder = new TextDecoder("utf-8");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);

    // OpenRouter streams data as server-sent events (SSE)
    for (const line of chunk.split("\n")) {
      if (line.startsWith("data: ")) {
        const data = line.substring(6).trim();
        if (data === "[DONE]") {
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
          }
        } catch (e) {
          console.error("Error parsing streaming chunk:", e);
        }
      }
    }
  }

  return {
    content: fullContent.trim(),
    isGenerating: false,
  };
};

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChatRequest {
  apiKey: string;
  model: string;
  messages: Message[];
  temperature: number;
  maxTokens: number;
  topP: number;
  signal?: AbortSignal;
  /** When true, prepends read-only WORD BLACKLIST RAG to the first user message. */
  contentHarness?: boolean;
}

export const streamChatCompletion = async ({
  apiKey,
  model,
  messages,
  temperature,
  maxTokens,
  topP,
  onContentChunk,
  onFinishReason,
  signal,
  contentHarness,
}: StreamChatRequest & { 
  onContentChunk: (chunk: string) => void;
  onFinishReason?: (reason: string) => void;
}): Promise<{ content: string; isGenerating: boolean; finishReason?: string }> => {
  const httpReferer = resolveOpenRouterWebReferer();

  let outboundMessages = messages;
  if (contentHarness) {
    const { injectBlacklistRagIntoMessages } = await import("@/lib/content-word-blocklist");
    outboundMessages = injectBlacklistRagIntoMessages(messages);
  }

  return streamOpenRouterChatCompletionCore({
    apiKey,
    model,
    messages: outboundMessages,
    temperature,
    maxTokens,
    topP,
    httpReferer,
    signal,
    onContentChunk,
    onFinishReason,
  });
};

export type { GenerationResult, ChatCompletionRequest };
