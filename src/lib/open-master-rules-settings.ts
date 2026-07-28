/** Session key: preset selected site when opening Dashboard → Master Rules from a property card. */
export const FLOWBIE_MASTER_RULES_PRESET_SITE_ID_KEY = "flowbie-master-rules-preset-site-id";

export const FLOWBIE_OPEN_MASTER_RULES_EVENT = "flowbie-open-master-rules";

/**
 * Opens Manager → Dashboard → Master Rules. Optionally presets the site selector (sessionStorage).
 */
export function openDashboardMasterRulesSettings(siteId?: string): void {
  if (typeof window === "undefined") return;
  if (siteId) {
    try {
      sessionStorage.setItem(FLOWBIE_MASTER_RULES_PRESET_SITE_ID_KEY, siteId);
    } catch {
      /* ignore */
    }
  }
  window.dispatchEvent(new CustomEvent(FLOWBIE_OPEN_MASTER_RULES_EVENT, { detail: { siteId } }));
}
