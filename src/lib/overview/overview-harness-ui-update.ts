import { startTransition } from "react";

/** Defer harness progress chrome so bulk AISEO does not block the main thread. */
export function deferHarnessUiUpdate(fn: () => void): void {
  startTransition(fn);
}
