import { MANAGER_SETTINGS_CLUSTER_KEY } from "@/components/manager/manager-settings-cluster";
import { WORDPRESS_SITES_STORAGE_KEY, KB_FILES_STORAGE_KEY } from "@/components/integrations/types";

/** Persisted so cloud restore + reload can hydrate Index LLM state. */
export const FLOWBIE_LLM_MODEL_KEY = "flowbie-llm-selected-model";
export const FLOWBIE_LLM_TEMPERATURE_KEY = "flowbie-llm-temperature";
export const FLOWBIE_LLM_MAX_TOKENS_KEY = "flowbie-llm-max-tokens";
export const FLOWBIE_LLM_TOP_P_KEY = "flowbie-llm-top-p";

const MANAGER_TAB_STORAGE_KEY = "flowbie-manager-tab";
const STORED_BLUEPRINTS_KEY = "stored-blueprints";

const EXACT_LOCAL_KEYS = [
  "openrouter-api-key",
  "dataforseo-api-key",
  "agentmail-api-key",
  "agentmail-general-email",
  "slack-bot-token",
  "slack-global-settings",
  WORDPRESS_SITES_STORAGE_KEY,
  KB_FILES_STORAGE_KEY,
  "kb_profiles",
  MANAGER_SETTINGS_CLUSTER_KEY,
  MANAGER_TAB_STORAGE_KEY,
  "global_research_model",
  "primaryColor",
  STORED_BLUEPRINTS_KEY,
  FLOWBIE_LLM_MODEL_KEY,
  FLOWBIE_LLM_TEMPERATURE_KEY,
  FLOWBIE_LLM_MAX_TOKENS_KEY,
  FLOWBIE_LLM_TOP_P_KEY,
] as const;

const PREFIX_KEYS = ["optimization_settings_", "optimization_mode_"] as const;

function readExactAndPrefixedLocalStorage(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const k of EXACT_LOCAL_KEYS) {
      const v = localStorage.getItem(k);
      if (v !== null) out[k] = v;
    }
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || Object.prototype.hasOwnProperty.call(out, k)) continue;
      for (const p of PREFIX_KEYS) {
        if (k.startsWith(p)) {
          const v = localStorage.getItem(k);
          if (v !== null) out[k] = v;
          break;
        }
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

export type ManagerCloudSnapshotV1 = {
  version: 1;
  collectedAt: string;
  keys: Record<string, string>;
};

export type ManagerCloudLlmSlice = {
  selectedModel: string;
  temperature: number;
  maxTokens: number;
  topP: number;
};

/**
 * Build a JSON snapshot of manager / integration settings (localStorage + current in-memory secrets / LLM).
 */
export function collectManagerCloudSettingsSnapshot(
  keyOverrides: Record<string, string | undefined>,
  llm: ManagerCloudLlmSlice,
): ManagerCloudSnapshotV1 {
  const keys = readExactAndPrefixedLocalStorage();
  for (const [k, v] of Object.entries(keyOverrides)) {
    if (typeof v === "string") keys[k] = v;
  }
  keys[FLOWBIE_LLM_MODEL_KEY] = llm.selectedModel;
  keys[FLOWBIE_LLM_TEMPERATURE_KEY] = String(llm.temperature);
  keys[FLOWBIE_LLM_MAX_TOKENS_KEY] = String(llm.maxTokens);
  keys[FLOWBIE_LLM_TOP_P_KEY] = String(llm.topP);
  return {
    version: 1,
    collectedAt: new Date().toISOString(),
    keys,
  };
}

/**
 * Write snapshot keys back to localStorage. Callers may `location.reload()` so React state matches.
 */
export function applyManagerCloudSnapshotToLocalStorage(snapshot: unknown): { keyCount: number; error?: string } {
  if (!snapshot || typeof snapshot !== "object") {
    return { keyCount: 0, error: "Invalid snapshot" };
  }
  const rec = snapshot as Record<string, unknown>;
  if (rec.version !== 1 || !rec.keys || typeof rec.keys !== "object") {
    return { keyCount: 0, error: "Unsupported snapshot format" };
  }
  const keys = rec.keys as Record<string, unknown>;
  let n = 0;
  try {
    for (const [k, v] of Object.entries(keys)) {
      if (typeof v !== "string") continue;
      localStorage.setItem(k, v);
      n++;
    }
    try {
      window.dispatchEvent(new CustomEvent("kb-files-updated", { detail: { reload: true } }));
    } catch {
      /* ignore */
    }
  } catch (e) {
    return { keyCount: n, error: e instanceof Error ? e.message : String(e) };
  }
  return { keyCount: n };
}

export function readStoredLlmModelForIndex(defaultModel: string): string {
  try {
    const t = localStorage.getItem(FLOWBIE_LLM_MODEL_KEY)?.trim();
    if (t) return t;
  } catch {
    /* ignore */
  }
  return defaultModel;
}

export function readStoredLlmNumberForIndex(key: string, fallback: number): number {
  try {
    const t = localStorage.getItem(key);
    if (t == null || t === "") return fallback;
    const n = Number(t);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}
