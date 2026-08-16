/** One-time localStorage key migration from Flowbie → NEO Pulse. */
export function migrateLegacyStorageKey(legacyKey: string, nextKey: string): void {
  if (typeof window === "undefined") return;
  try {
    const existing = window.localStorage.getItem(nextKey);
    const legacy = window.localStorage.getItem(legacyKey);
    if (existing == null && legacy != null) {
      window.localStorage.setItem(nextKey, legacy);
    }
    if (legacy != null) {
      window.localStorage.removeItem(legacyKey);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

const LEGACY_STORAGE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["flowbie-workspace", "neo-pulse-workspace"],
  ["flowbie-manager-tab", "neo-pulse-manager-tab"],
  ["flowbie-manager-settings-cluster", "neo-pulse-manager-settings-cluster"],
  ["flowbie_session_token", "neo_pulse_session_token"],
  ["flowbie-active-wp-site-id", "neo-pulse-active-wp-site-id"],
];

export function migrateAllLegacyNeoPulseStorageKeys(): void {
  for (const [legacy, next] of LEGACY_STORAGE_PAIRS) {
    migrateLegacyStorageKey(legacy, next);
  }
}
