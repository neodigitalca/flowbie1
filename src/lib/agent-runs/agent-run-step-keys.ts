export const AGENT_RUN_STEP_KEYS = {
  starting: "starting",
  preflight: "preflight",
  contentBucket: "content-bucket",
  ideas: "ideas",
  bulkStart: "bulk.start",
  complete: "complete",
} as const;

export function postCreatorRowStepKey(rowIndex: number, phase: string): string {
  return `post.${rowIndex}.${phase}`;
}

export function postCreatorHarnessStepKey(rowIndex: number, sectionIndex: number): string {
  return `post.${rowIndex}.harness.${sectionIndex}`;
}
