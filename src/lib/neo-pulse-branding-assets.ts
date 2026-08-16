const base = import.meta.env.BASE_URL || "/";

function brandingAsset(filename: string): string {
  return `${base}branding/${filename}`;
}

/** Green mark + dark wordmark — for light backgrounds only. */
export const NEO_PULSE_BRAND_DARK_SRC = brandingAsset("neo-pulse-dark.svg");

/** Green mark + white wordmark — default for the always-dark app shell. */
export const NEO_PULSE_BRAND_LIGHT_SRC = brandingAsset("neo-pulse-light.svg");

/** Green mark + neoassist wordmark (neo-chat style) — Pulse Assist launcher. */
export const NEO_ASSIST_BRAND_LIGHT_SRC = brandingAsset("neo-assist-light.svg");

export const NEO_PULSE_BRAND_LOCKUP_SRC = NEO_PULSE_BRAND_LIGHT_SRC;
