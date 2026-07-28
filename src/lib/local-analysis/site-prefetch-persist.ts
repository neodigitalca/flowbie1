import type { SiteInventoryBulkRow } from "@/lib/wordpress-api/types";
import type { EntityGscKeywordBundle } from "@/lib/bulk/bulk-gsc-site-queries";
import type { PromptBulkSitemapInventoryBuckets } from "@/lib/bulk/prompt-bulk-sitemap-inventory";
import type { EntitySiteWarmBundle, EntitySiteWarmCounts } from "@/lib/local-analysis/entity-site-warm-cache";

const DB_NAME = "flowbie-site-prefetch";
const DB_VERSION = 1;
const STORE = "bundles";
const STORAGE_PREFIX = "flowbie-site-prefetch:v1:";

export type PersistedSitePrefetch = {
  siteId: string;
  credentialsKey: string;
  fetchedAt: number;
  inventory: {
    buckets: PromptBulkSitemapInventoryBuckets;
    totalRows: number;
    sources: EntitySiteWarmBundle["inventory"]["sources"];
    errors: Record<string, string>;
    postsMetadata: EntitySiteWarmBundle["inventory"]["postsMetadata"];
  };
  gsc: EntityGscKeywordBundle;
  counts: EntitySiteWarmCounts;
  bulkInventoryRows: SiteInventoryBulkRow[];
  error?: string;
};

function storageKey(siteId: string, credentialsKey: string): string {
  return `${STORAGE_PREFIX}${siteId}:${credentialsKey}`;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => resolve(null);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

async function idbGet(key: string): Promise<PersistedSitePrefetch | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve((req.result as PersistedSitePrefetch | undefined) ?? null);
    req.onerror = () => resolve(null);
  });
}

async function idbSet(key: string, value: PersistedSitePrefetch): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

function readLocalStorage(key: string): PersistedSitePrefetch | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedSitePrefetch;
  } catch {
    return null;
  }
}

function writeLocalStorage(key: string, value: PersistedSitePrefetch): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota */
  }
}

function removeLocalStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function bundleToPersisted(bundle: EntitySiteWarmBundle): PersistedSitePrefetch {
  return {
    siteId: bundle.siteId,
    credentialsKey: bundle.credentialsKey,
    fetchedAt: bundle.fetchedAt,
    inventory: {
      buckets: bundle.inventory.buckets,
      totalRows: bundle.inventory.totalRows,
      sources: bundle.inventory.sources,
      errors: bundle.inventory.errors,
      postsMetadata: bundle.inventory.postsMetadata,
    },
    gsc: bundle.gsc,
    counts: bundle.counts,
    bulkInventoryRows: bundle.bulkInventoryRows ?? [],
    error: bundle.error,
  };
}

export async function readSitePrefetchPersist(
  siteId: string,
  credentialsKey: string,
): Promise<EntitySiteWarmBundle | null> {
  const key = storageKey(siteId, credentialsKey);
  const fromIdb = await idbGet(key);
  const persisted = fromIdb ?? readLocalStorage(key);
  if (!persisted || persisted.siteId !== siteId || persisted.credentialsKey !== credentialsKey) {
    return null;
  }
  return {
    siteId: persisted.siteId,
    credentialsKey: persisted.credentialsKey,
    fetchedAt: persisted.fetchedAt,
    inventory: {
      links: [],
      buckets: persisted.inventory.buckets,
      totalRows: persisted.inventory.totalRows,
      sources: persisted.inventory.sources,
      errors: persisted.inventory.errors,
      postsMetadata: persisted.inventory.postsMetadata,
    },
    gsc: persisted.gsc,
    counts: persisted.counts,
    bulkInventoryRows: persisted.bulkInventoryRows,
    error: persisted.error,
  };
}

export async function writeSitePrefetchPersist(bundle: EntitySiteWarmBundle): Promise<void> {
  if (bundle.error) return;
  const key = storageKey(bundle.siteId, bundle.credentialsKey);
  const persisted = bundleToPersisted(bundle);
  writeLocalStorage(key, persisted);
  await idbSet(key, persisted);
}

export async function deleteSitePrefetchPersist(siteId: string): Promise<void> {
  if (typeof indexedDB !== "undefined") {
    const db = await openDb();
    if (db) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE, "readwrite");
        const store = tx.objectStore(STORE);
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) return;
          const key = String(cursor.key);
          if (key.startsWith(`${STORAGE_PREFIX}${siteId}:`)) {
            cursor.delete();
          }
          cursor.continue();
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    }
  }
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(`${STORAGE_PREFIX}${siteId}:`)) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }
}
