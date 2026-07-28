import type { Dispatch, SetStateAction } from "react";
import type {
  BulkProgressSlice,
  MetaBulkActionKey,
} from "@/components/overview/overview-tab-constants";
import { BULK_INLINE_STATUS, META_BULK_MICRO_ORDER } from "@/components/overview/overview-tab-constants";

export { BULK_INLINE_STATUS, AI_ALL_META_PHASE_STATUS } from "@/components/overview/overview-tab-constants";

export type SetBulkActionProgress = Dispatch<
  SetStateAction<Partial<Record<MetaBulkActionKey, BulkProgressSlice>>>
>;

/** First active bulk slice in UI priority order. */
export function pickActiveBulkProgressSlice(
  bulkActionProgress: Partial<Record<MetaBulkActionKey, BulkProgressSlice>>,
): { key: MetaBulkActionKey; slice: BulkProgressSlice } | null {
  for (const key of META_BULK_MICRO_ORDER) {
    const slice = bulkActionProgress[key];
    if (slice && slice.total > 0) {
      return { key, slice };
    }
  }
  return null;
}

export function bulkInlineStatusForKey(key: MetaBulkActionKey): string {
  return BULK_INLINE_STATUS[key] ?? "";
}

/** Status-only updates (no flushSync). Merges into existing slice. */
export function patchActiveBulkSlice(
  setBulkActionProgress: SetBulkActionProgress,
  key: MetaBulkActionKey,
  patch: Partial<BulkProgressSlice>,
): void {
  setBulkActionProgress((p) => {
    const cur = p[key];
    if (!cur) return p;
    return {
      ...p,
      [key]: { ...cur, ...patch },
    };
  });
}

export function initBulkSliceWithStatus(
  key: MetaBulkActionKey,
  total: number,
  completed = 0,
  statusOverride?: string,
): BulkProgressSlice {
  return {
    total,
    completed,
    statusMessage: statusOverride ?? (bulkInlineStatusForKey(key) || undefined),
  };
}
