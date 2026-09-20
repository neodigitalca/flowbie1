/** Ignore stale fetch responses when a newer load started. */
export function shouldApplyFetchedWorkflow(options: {
  responseSeq: number;
  latestLoadSeq: number;
  isDirty: boolean;
}): boolean {
  if (options.responseSeq !== options.latestLoadSeq) return false;
  if (options.isDirty) return false;
  return true;
}

/** New workflow drafts reset only when team context changes, not when defaultSiteId arrives. */
export function shouldInitializeNewWorkflowDraft(options: {
  draftScopeKey: string | null;
  nextScopeKey: string;
}): boolean {
  return options.draftScopeKey !== options.nextScopeKey;
}

/** Full-page spinner only when this workflow is not already on screen. */
export function shouldShowWorkflowLoadSpinner(options: {
  loadedWorkflowId: number | null | undefined;
  nextWorkflowId: number;
}): boolean {
  return options.loadedWorkflowId !== options.nextWorkflowId;
}

export function newWorkflowDraftScopeKey(teamId: number): string {
  return `new:${teamId}`;
}
