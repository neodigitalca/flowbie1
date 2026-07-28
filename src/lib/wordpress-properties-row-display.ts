/**
 * Superficial density for Integrations → Properties list rows only (local UI pref).
 * Does not affect saved sites, APIs, or expanded panel logic.
 */

export type WordPressPropertyRowDisplay = "standard" | "compact";

const STORAGE_KEY = "flowbie_wp_property_row_display";

export function readWordPressPropertyRowDisplay(): WordPressPropertyRowDisplay {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "compact" || raw === "standard") return raw;
  } catch {
    /* ignore */
  }
  return "compact";
}

export function writeWordPressPropertyRowDisplay(value: WordPressPropertyRowDisplay): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* ignore quota */
  }
}
