import { OptimizationFileManager } from '@/lib/optimization-file-manager';
import type { SemrushBulkEnrichmentResult } from '@/lib/wordpress-api/semrush';
import type { SemrushClusterScatterPlan } from '@/lib/semrush-cluster-scatter';

export function saveSemRushData(
  fileManager: OptimizationFileManager,
  payload: {
    url: string;
    acfKeyword: string;
    gscDateRange?: { startDate: string; endDate: string };
    gscQueryCount?: number;
    semrush: SemrushBulkEnrichmentResult;
    /** Cluster + scatter plan (every Semrush run with keywords). */
    clusterScatter?: SemrushClusterScatterPlan;
  }
): void {
  const sanitized = OptimizationFileManager.sanitizeFilename(payload.url);
  const ts = Date.now();
  const base = `sem_rush-${sanitized}-${ts}`;
  fileManager.addFile(
    `${base}.json`,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        url: payload.url,
        acfKeyword: payload.acfKeyword,
        gscDateRange: payload.gscDateRange,
        gscQueryCount: payload.gscQueryCount,
        semrush: payload.semrush,
        /** Flat list for validating links (also inside semrush). */
        externalSemrushUrls: payload.semrush.externalSemrushUrls ?? [],
        clusterScatter: payload.clusterScatter,
      },
      null,
      2
    ),
    'application/json'
  );
}
