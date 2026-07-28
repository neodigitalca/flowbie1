import { notify } from "@/lib/app-notifications";
import { NOTIFY_APPROVAL_EXPIRED } from "@/lib/notify-messages";

export type BulkKeywordApprovalWaiter = {
  resolve: () => void;
  setBulkOptimizationState?: (updater: (prev: any) => any) => void;
};

export const getApprovalWaiters = (): Map<string, BulkKeywordApprovalWaiter> => {
  const w = window as unknown as { __flowbieBulkApprovalWaiters?: Map<string, BulkKeywordApprovalWaiter> };
  if (!w.__flowbieBulkApprovalWaiters) {
    w.__flowbieBulkApprovalWaiters = new Map<string, BulkKeywordApprovalWaiter>();
  }
  return w.__flowbieBulkApprovalWaiters;
};

/** Batch keys for which the user aborted while the bulk runner was waiting on keyword approval. */
const cancelledDuringApproval = new Set<string>();

/** Unblocks the approval wait (e.g. user hit Abort) so the bulk runner can exit without starting the post loop. */
export function cancelBulkKeywordWait(batchKey: string): void {
  const waiters = getApprovalWaiters();
  const waiter = waiters.get(batchKey);
  if (waiter) {
    cancelledDuringApproval.add(batchKey);
    waiter.resolve();
    waiters.delete(batchKey);
  }
}

/** If the run was cancelled during the approval phase, consume the flag (returns true once). */
export function consumeBulkRunCancelledDuringApproval(batchKey: string): boolean {
  if (!cancelledDuringApproval.has(batchKey)) return false;
  cancelledDuringApproval.delete(batchKey);
  return true;
}

export function approveBulkKeywordApproval(batchKey: string): void {
  const waiters = getApprovalWaiters();
  const waiter = waiters.get(batchKey);
  if (!waiter) {
    console.error(
      `[Bulk] approveBulkKeywordApproval: no waiter found for batchKey="${batchKey}". Active keys: [${Array.from(waiters.keys()).join(", ")}]`
    );
    notify.error(NOTIFY_APPROVAL_EXPIRED, {
      duration: 6000,
    });
    return;
  }

  waiter.setBulkOptimizationState?.((prev: any) => {
    const current = prev?.[batchKey];
    if (!current) return prev;
    return {
      ...prev,
      [batchKey]: {
        ...current,
        keywordApprovalStatus: "approved",
        currentStep: "Approved - starting research...",
        currentStepProgress: {
          step: "Approved - starting research...",
          progress: 0,
          message: "Research is now running.",
        },
      },
    };
  });

  waiter.resolve();
  waiters.delete(batchKey);
}
