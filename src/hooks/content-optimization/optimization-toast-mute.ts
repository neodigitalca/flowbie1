/**
 * When true, optimization-related toasts may be suppressed (callers check via getMuteOptimizationToasts).
 * Reserved for long-running bulk flows; bulk-optimization can pass muteToasts per invocation instead.
 */
let muteOptimizationToasts = false;

export function getMuteOptimizationToasts(): boolean {
  return muteOptimizationToasts;
}

export function setMuteOptimizationToasts(value: boolean): void {
  muteOptimizationToasts = value;
}
