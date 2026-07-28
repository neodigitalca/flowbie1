import { notify } from "@/lib/app-notifications";
import {
  NOTIFY_COULD_NOT_FIND_THAT_FILE_IN_KNOWLEDGE_BA,
  NOTIFY_DOWNLOADED_SITE_INVENTORY_JSON,
  NOTIFY_FAILED_TO_READ_KNOWLEDGE_BASE_FILES,
} from "@/lib/notify-messages";
import type { StoredFile } from "@/components/KnowledgeBaseTab";
import { isWpSiteInventoryKbFileName } from "@/lib/kb-wp-inventory";

const KB_FILES_KEY = "kb_files";

export function resolveWpInventoryKbFileName(explicit: string | null | undefined): string | null {
  if (explicit) return explicit;
  try {
    const raw = localStorage.getItem(KB_FILES_KEY) || "[]";
    const files = JSON.parse(raw) as StoredFile[];
    const candidates = files.filter((f) => isWpSiteInventoryKbFileName(f.name));
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    return candidates[0].name;
  } catch {
    return null;
  }
}

export function downloadWpInventoryKbJsonByName(fileName: string): void {
  try {
    const raw = localStorage.getItem(KB_FILES_KEY) || "[]";
    const files = JSON.parse(raw) as StoredFile[];
    const f = files.find((x) => x.name === fileName);
    if (!f?.content) {
      notify.error(NOTIFY_COULD_NOT_FIND_THAT_FILE_IN_KNOWLEDGE_BA);
      return;
    }
    const blob = new Blob([f.content], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    notify.success(NOTIFY_DOWNLOADED_SITE_INVENTORY_JSON);
  } catch {
    notify.error(NOTIFY_FAILED_TO_READ_KNOWLEDGE_BASE_FILES);
  }
}
