import type { WordPressSite } from "@/components/integrations/types";
import { getSiteInventoryBulk } from "@/lib/wordpress-api";
import type { SiteInventoryBulkRow } from "@/lib/wordpress-api/types";
import {
  compactInventoryKeywordsForJson,
  stringifyInventoryJsonFromKeywords,
} from "@/lib/bulk/inventory-json-slim";
import type { PressReleaseInventoryRow } from "@/lib/press-release/press-release-anchor-from-inventory";

function hostSlugForInventoryFile(siteUrl: string): string {
  try {
    const raw = siteUrl.trim();
    const withProto = raw.startsWith("http") ? raw : `https://${raw}`;
    const u = new URL(withProto);
    return u.hostname.replace(/[^a-zA-Z0-9.-]+/g, "-").slice(0, 80) || "site";
  } catch {
    return "site";
  }
}

export type PressReleaseInventoryHostedLink = {
  href: string;
  filename: string;
  rowCount: number;
};

/** In-session blob URL (open in new tab). Caller must revoke via {@link revokePressReleaseInventoryHostedLink}. */
export function createPressReleaseInventoryHostedLink(
  siteUrl: string,
  keywords: string[],
): PressReleaseInventoryHostedLink {
  const filename = `wp-site-inventory-${hostSlugForInventoryFile(siteUrl)}-${Date.now()}.txt`;
  const text = stringifyInventoryJsonFromKeywords(keywords);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  return {
    href,
    filename,
    rowCount: keywords.length,
  };
}

export function revokePressReleaseInventoryHostedLink(href: string | null | undefined): void {
  if (href?.startsWith("blob:")) {
    URL.revokeObjectURL(href);
  }
}

/** Fetch published posts + pages (single bulk API call). */
export async function fetchPressReleaseSiteInventory(site: WordPressSite): Promise<{
  rows: PressReleaseInventoryRow[];
  inventoryJson: string[] | null;
  error?: string;
}> {
  if (!site.username?.trim() || !site.appPassword?.trim()) {
    return { rows: [], inventoryJson: null, error: "WordPress username and application password are required to load post inventory." };
  }

  try {
    const bulk = await getSiteInventoryBulk(site.siteUrl, site.username, site.appPassword, {
      includeRawAcf: true,
      collections: ["posts", "pages"],
    });

    if (bulk.error?.trim() && !(bulk.rows?.length ?? 0)) {
      return { rows: [], inventoryJson: null, error: bulk.error.trim() };
    }

    const rows: PressReleaseInventoryRow[] = (bulk.rows ?? []).map((row: SiteInventoryBulkRow) => ({
      id: row.id,
      slug: row.slug,
      date_gmt: row.date_gmt,
      url: row.url,
      acf: row.acf,
      fields: row.fields,
      collection: row.collection,
    }));

    const inventoryJson = compactInventoryKeywordsForJson(bulk.rows ?? []);

    const partialErrors = bulk.errors ? Object.values(bulk.errors).filter(Boolean).join("; ") : "";
    return {
      rows,
      inventoryJson,
      error: partialErrors || undefined,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not fetch WordPress inventory.";
    return { rows: [], inventoryJson: null, error: msg };
  }
}
