export const TASK_EXECUTION_TARGET_ALL = "ALL";

export function isTaskExecutionTargetAll(value: string | undefined | null): boolean {
  return String(value ?? "").trim().toUpperCase() === TASK_EXECUTION_TARGET_ALL;
}

export function normalizeTaskExecutionTarget(value: string): string {
  const trimmed = value.trim();
  if (isTaskExecutionTargetAll(trimmed)) return TASK_EXECUTION_TARGET_ALL;
  return trimmed;
}

export function taskExecutionTargetIsSet(value: string | undefined | null): boolean {
  return String(value ?? "").trim().length > 0;
}
