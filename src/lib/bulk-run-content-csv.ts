import type { BulkGeneratedFile } from '@/lib/bulk-file-manager';

function escapeCsvField(s: string): string {
  if (s.length === 0) return s;
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function pickLatestByRow<T extends { rowIndex: number; timestamp: number }>(items: T[]): Map<number, T> {
  const m = new Map<number, T>();
  for (const it of items) {
    const prev = m.get(it.rowIndex);
    if (!prev || it.timestamp >= prev.timestamp) m.set(it.rowIndex, it);
  }
  return m;
}

/**
 * One CSV with every generated markdown post body in a run, plus metadata and any WordPress URLs
 * from successful uploads. For manual import if automated upload fails.
 */
export function buildBulkRunContentCsv(files: BulkGeneratedFile[]): { csv: string; rowCount: number } {
  const completed = files.filter((f) => f.status === 'completed');
  const contentFiles = completed.filter(
    (f) => f.mimeType === 'text/markdown' && f.fileName.startsWith('content-') && f.fileName.endsWith('.md')
  );
  const byRowContent = pickLatestByRow(contentFiles);

  const wpFiles = completed.filter((f) => f.fileName.startsWith('wordpress-post-') && f.fileName.endsWith('.json'));
  const linksByRow = new Map<number, string[]>();
  const wpLatestByRow = pickLatestByRow(wpFiles);
  const scheduledIsoByRow = new Map<number, string>();
  for (const f of wpFiles) {
    try {
      const parsed = JSON.parse(f.content) as { link?: string };
      if (typeof parsed.link === 'string' && parsed.link.trim()) {
        const arr = linksByRow.get(f.rowIndex) ?? [];
        arr.push(parsed.link.trim());
        linksByRow.set(f.rowIndex, arr);
      }
    } catch {
      /* skip malformed */
    }
  }
  for (const [rowIdx, f] of wpLatestByRow) {
    try {
      const parsed = JSON.parse(f.content) as { scheduledDate?: string };
      const s = typeof parsed.scheduledDate === 'string' ? parsed.scheduledDate.trim() : '';
      if (s) scheduledIsoByRow.set(rowIdx, s);
    } catch {
      /* skip malformed */
    }
  }

  const rowIndices = Array.from(byRowContent.keys()).sort((a, b) => a - b);
  if (rowIndices.length === 0) {
    return { csv: '', rowCount: 0 };
  }

  const headers = [
    'row_index',
    'title',
    'keyword',
    'entity',
    'modifier',
    'origin',
    'meta_description',
    'scheduled_date_gmt',
    'content_markdown',
    'wordpress_post_urls',
  ];

  const lines: string[] = [headers.map((h) => escapeCsvField(h)).join(',')];

  for (const rowIndex of rowIndices) {
    const cf = byRowContent.get(rowIndex);
    if (!cf) continue;
    const rd = cf.rowData;
    const wp = linksByRow.get(rowIndex);
    const row = [
      String(rowIndex + 1),
      rd.title ?? '',
      rd.keyword ?? '',
      rd.entity ?? '',
      rd.modifier ?? '',
      rd.origin ?? '',
      rd.meta_description ?? '',
      scheduledIsoByRow.get(rowIndex) ?? '',
      cf.content ?? '',
      wp?.length ? wp.join(' | ') : '',
    ];
    lines.push(row.map(escapeCsvField).join(','));
  }

  const csv = '\uFEFF' + lines.join('\r\n');
  return { csv, rowCount: rowIndices.length };
}
