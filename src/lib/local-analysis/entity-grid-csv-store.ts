/** Persist Local Dominator grid CSV in IndexedDB so Neighbourhood AdGroups survive refresh. */

const DB_NAME = "neo-pulse-entity-grid-csv";
const DB_VERSION = 1;
const STORE = "grids";

export type PersistedEntityGridCsv = {
  siteId: string;
  uploadLabel: string;
  csvText: string;
  savedAt: number;
};

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

export async function saveEntityGridCsv(args: {
  siteId: string;
  uploadLabel: string;
  csvText: string;
}): Promise<void> {
  const text = args.csvText.trim();
  if (!args.siteId.trim() || !text) return;
  const db = await openDb();
  if (!db) return;
  const value: PersistedEntityGridCsv = {
    siteId: args.siteId,
    uploadLabel: args.uploadLabel.trim(),
    csvText: text,
    savedAt: Date.now(),
  };
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, args.siteId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function loadEntityGridCsv(
  siteId: string,
): Promise<PersistedEntityGridCsv | null> {
  if (!siteId.trim()) return null;
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(siteId);
    req.onsuccess = () => {
      const row = req.result as PersistedEntityGridCsv | undefined;
      if (!row?.csvText?.trim()) {
        resolve(null);
        return;
      }
      resolve(row);
    };
    req.onerror = () => resolve(null);
  });
}

export async function clearEntityGridCsv(siteId: string): Promise<void> {
  if (!siteId.trim()) return;
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(siteId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
