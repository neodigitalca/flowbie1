/** Session key: preset selected site when opening Dashboard → Master Rules from a property card. */
export const NEO_PULSE_MASTER_RULES_PRESET_SITE_ID_KEY = "neo-pulse-master-rules-preset-site-id";

export const NEO_PULSE_OPEN_MASTER_RULES_EVENT = "neo-pulse-open-master-rules";

/**
 * Opens Manager → Dashboard → Master Rules. Optionally presets the site selector (sessionStorage).
 */
export function openDashboardMasterRulesSettings(siteId?: string): void {
  if (typeof window === "undefined") return;
  if (siteId) {
    try {
      sessionStorage.setItem(NEO_PULSE_MASTER_RULES_PRESET_SITE_ID_KEY, siteId);
    } catch {
      /* ignore */
    }
  }
  window.dispatchEvent(new CustomEvent(NEO_PULSE_OPEN_MASTER_RULES_EVENT, { detail: { siteId } }));
}
