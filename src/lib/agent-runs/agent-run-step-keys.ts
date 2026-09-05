export const AGENT_RUN_STEP_KEYS = {
  starting: "starting",
  preflight: "preflight",
  contentBucket: "content-bucket",
  ideas: "ideas",
  bulkStart: "bulk.start",
  complete: "complete",
  contentGap: "content-gap",
  gscBundleApi: "gsc-bundle-api",
  gscBundleReady: "gsc-bundle-ready",
  gscOutlineGenerating: "gsc-outline-generating",
  gscOutline: "gsc-outline",
  gscSection: "gsc-section",
  gscDeliverables: "gsc-deliverables",
  automationGoogleDriveResolve: "automation-google-drive-resolve",
  automationGoogleDriveUpload: "automation-google-drive-upload",
  automationGoogleDriveComplete: "automation-google-drive-complete",
  automationGoogleDriveError: "automation-google-drive-error",
  automationEmailSend: "automation-email-send",
  automationEmailComplete: "automation-email-complete",
  automationEmailError: "automation-email-error",
  automationLocalComplete: "automation-local-complete",
  automationDelivery: "automation-delivery",
  dfsArticleAudit: "dfs-article-audit",
  /** @deprecated Legacy workflow-bound keys */
  workflowGoogleDrive: "workflow-google-drive",
  /** @deprecated Legacy workflow-bound keys */
  workflowEmail: "workflow-email",
} as const;

export function gscSectionStepKey(index: number): string {
  return `gsc-section-${index}`;
}

export function postCreatorRowStepKey(rowIndex: number, phase: string): string {
  return `post.${rowIndex}.${phase}`;
}

export function postCreatorHarnessStepKey(rowIndex: number, sectionIndex: number): string {
  return `post.${rowIndex}.harness.${sectionIndex}`;
}
