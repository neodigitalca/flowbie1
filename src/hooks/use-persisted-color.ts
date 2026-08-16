import { hexToHslComponents } from "../lib/utils";
import {
  DEFAULT_THEME_PRIMARY_HEX,
  LEGACY_DEEP_EMERALD_HEX,
  LEGACY_EMERALD_PRIMARY_HEX,
  LEGACY_NEON_PRIMARY_HEX,
  LEGACY_THEME_PRIMARY_HEX,
} from "../lib/theme-defaults";

const COLOR_KEY = "primaryColor";

export function applyPrimaryHexToDocument(hex: string): void {
  if (typeof document === "undefined" || !hex) return;
  const hslComponents = hexToHslComponents(hex);
  document.documentElement.style.setProperty("--primary", hslComponents);
  document.documentElement.style.setProperty("--ring", hslComponents);
  document.documentElement.style.setProperty("--accent", hslComponents);
  document.documentElement.style.setProperty("--neural-glow", hslComponents);
  document.documentElement.style.setProperty("--neo-pulse-glow", hslComponents);
  document.documentElement.style.setProperty("--primary-color", hex);
}

/** Run once on app load: migrate legacy yellow-green, sync CSS from localStorage. */
export function initPrimaryColorFromStorage(): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const stored = localStorage.getItem(COLOR_KEY);
  let hex = DEFAULT_THEME_PRIMARY_HEX;
  if (stored) {
    const s = stored.toLowerCase();
    if (
      s === LEGACY_THEME_PRIMARY_HEX.toLowerCase() ||
      s === LEGACY_NEON_PRIMARY_HEX.toLowerCase() ||
      s === LEGACY_EMERALD_PRIMARY_HEX.toLowerCase() ||
      s === LEGACY_DEEP_EMERALD_HEX.toLowerCase()
    ) {
      hex = DEFAULT_THEME_PRIMARY_HEX;
      localStorage.setItem(COLOR_KEY, hex);
    } else {
      hex = stored;
    }
  }
  applyPrimaryHexToDocument(hex);
}
