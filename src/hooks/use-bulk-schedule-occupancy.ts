import { useCallback, useEffect, useRef, useState } from 'react';
import type { WordPressSite } from '@/components/integrations/types';
import {
  buildScheduleOccupancyFromInventoryRows,
  type ScheduleOccupancy,
} from '@/lib/bulk-schedule-gap';
import {
  clearBulkGenerationWpInventory,
  ensureBulkGenerationWpInventory,
} from '@/lib/bulk/bulk-generation-wp-inventory';

const occupancyBySiteId = new Map<string, ScheduleOccupancy>();

export interface UseBulkScheduleOccupancyParams {
  site: WordPressSite | null | undefined;
  enabled: boolean;
}

export interface UseBulkScheduleOccupancyResult {
  occupancy: ScheduleOccupancy | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<ScheduleOccupancy | null>;
}

export function useBulkScheduleOccupancy({
  site,
  enabled,
}: UseBulkScheduleOccupancyParams): UseBulkScheduleOccupancyResult {
  const [occupancy, setOccupancy] = useState<ScheduleOccupancy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const fetchOccupancy = useCallback(async (): Promise<ScheduleOccupancy | null> => {
    if (!site?.siteUrl?.trim() || !site.username?.trim() || !site.appPassword?.trim()) {
      setOccupancy(null);
      setError(null);
      return null;
    }

    const cached = occupancyBySiteId.get(site.id);
    if (cached) {
      setOccupancy(cached);
      setError(null);
      return cached;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const inv = await ensureBulkGenerationWpInventory(site);

      if (requestId !== requestIdRef.current) return null;

      if (inv.error?.trim()) {
        setOccupancy(null);
        setError(null);
        return null;
      }

      const built = buildScheduleOccupancyFromInventoryRows(inv.rows ?? []);
      occupancyBySiteId.set(site.id, built);
      setOccupancy(built);
      setError(null);
      return built;
    } catch {
      if (requestId !== requestIdRef.current) return null;
      setOccupancy(null);
      setError(null);
      return null;
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [site]);

  const refresh = useCallback(async (): Promise<ScheduleOccupancy | null> => {
    if (site?.id) {
      occupancyBySiteId.delete(site.id);
      clearBulkGenerationWpInventory(site.id);
    }
    return fetchOccupancy();
  }, [fetchOccupancy, site?.id]);

  useEffect(() => {
    if (!enabled) {
      setOccupancy(null);
      setError(null);
      setLoading(false);
      return;
    }
    void fetchOccupancy();
  }, [enabled, fetchOccupancy]);

  return { occupancy, loading, error, refresh };
}

/** Clear cached occupancy for tests or site credential changes. */
export function clearBulkScheduleOccupancyCache(siteId?: string): void {
  if (siteId) {
    occupancyBySiteId.delete(siteId);
    clearBulkGenerationWpInventory(siteId);
  } else {
    occupancyBySiteId.clear();
    clearBulkGenerationWpInventory();
  }
}
