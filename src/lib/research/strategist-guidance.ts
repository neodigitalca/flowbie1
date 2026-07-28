/** Max chars injected into OpenRouter user messages for proposal / report guidance. */
export const STRATEGIST_GUIDANCE_MAX_CHARS = 4000 as const;

/**
 * Prefix for strategist OpenRouter user messages when the user provides optional guidance.
 */
export function formatStrategistGuidancePrefix(guidance: string | undefined | null): string {
  const t = typeof guidance === "string" ? guidance.trim() : "";
  if (!t) return "";
  const collapsed = t.replace(/\s+/g, " ").slice(0, STRATEGIST_GUIDANCE_MAX_CHARS);
  return `USER_STRATEGIST_GUIDANCE: ${collapsed}\n\n`;
}
