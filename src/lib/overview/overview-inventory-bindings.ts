import type { OverviewBinding } from "@/hooks/overview/use-overview-wordpress-binding";
import { overviewTitlePrimarySegment } from "@/lib/overview/overview-tab-display";
import {
  lookupInventoryRowWithSource,
  type BulkOptimizerInventorySnapshot,
} from "@/lib/wordpress-api/inventory-match";

function plainWpTitle(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (!/[<>&]/.test(s)) return s;
  if (typeof document !== "undefined") {
    const el = document.createElement("div");
    el.innerHTML = s;
    return el.textContent?.trim() ?? s;
  }
  return s;
}

/** Snapshot lookup only — no resolve-urls, no prefetch, no per-URL REST. */
export function bindingsFromInventorySnapshot(
  snapshot: BulkOptimizerInventorySnapshot,
  siteUrl: string,
  urls: string[],
): { bindings: Record<string, OverviewBinding>; titlesByUrl: Record<string, string> } {
  const bindings: Record<string, OverviewBinding> = {};
  const titlesByUrl: Record<string, string> = {};

  for (const url of urls) {
    const hit = lookupInventoryRowWithSource(snapshot, siteUrl, url, "other");
    if (!hit?.row?.id) continue;
    const subtype =
      hit.source === "pages" ? "page" : hit.source === "posts" ? "post" : hit.source;
    bindings[url] = {
      postId: hit.row.id,
      subtype,
      date_gmt: hit.row.date_gmt,
    };
    const t = hit.row.fields?.title;
    if (t) {
      const plain = overviewTitlePrimarySegment(plainWpTitle(t));
      if (plain) titlesByUrl[url] = plain;
    }
  }

  return { bindings, titlesByUrl };
}
