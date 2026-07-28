/**
 * WordPress full-site inventory files are saved into KB storage for download/audit,
 * but they must NOT be merged into the "RAG / ideas" knowledge text - only passed
 * separately as SITE_INVENTORY_JSON for cannibalization (set subtraction).
 */

import type { SitePostInventoryKbPayload } from "@/lib/wordpress-api/types";
import { stringifyWpInventoryKbTuples } from "@/lib/bulk/inventory-json-slim";

export function kbFileBaseName(fileName: string): string {
  const parts = fileName.split('.chunk.');
  return parts[0] ?? fileName;
}

export function isWpSiteInventoryKbFileName(name: string): boolean {
  const base = kbFileBaseName(name);
  return base.startsWith('wp-site-inventory-') && base.endsWith('.json');
}

export function filterStoredFilesExcludingWpSiteInventory<T extends { name: string }>(files: T[]): T[] {
  return files.filter((f) => !isWpSiteInventoryKbFileName(f.name));
}

/** Tuple array JSON [path, title] for KB storage. */
export function wpInventoryPayloadForKbStorage(payload: SitePostInventoryKbPayload): string {
  return stringifyWpInventoryKbTuples(payload.posts);
}
