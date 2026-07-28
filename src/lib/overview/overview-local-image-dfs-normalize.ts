/**
 * Shared normalize for DataForSEO Google Images (client + tests).
 * Mirrors server/dataforseo-google-images-normalize.js
 */

export type GoogleImagesSerpItem = {
  title: string;
  source_url: string;
  image_url: string;
  alt: string;
  rank: number;
};

export function normalizeGoogleImagesSerpItems(result: unknown): GoogleImagesSerpItem[] {
  const items: GoogleImagesSerpItem[] = [];
  if (!result || typeof result !== "object") return items;

  const root = result as Record<string, unknown>;
  let buckets: unknown[] = [];

  if (Array.isArray(root.tasks)) {
    for (const task of root.tasks) {
      const taskResult =
        task && typeof task === "object"
          ? (task as { result?: unknown }).result
          : null;
      if (Array.isArray(taskResult)) buckets.push(...taskResult);
    }
  } else if (Array.isArray(root.result)) {
    buckets.push(...root.result);
  } else if (Array.isArray(root.items)) {
    buckets = [root];
  }

  for (const bucket of buckets) {
    if (!bucket || typeof bucket !== "object") continue;
    const list = Array.isArray((bucket as { items?: unknown }).items)
      ? ((bucket as { items: unknown[] }).items)
      : [];
    for (const el of list) {
      if (!el || typeof el !== "object") continue;
      const row = el as Record<string, unknown>;
      const type = String(row.type || "").toLowerCase();
      if (type === "carousel" || type === "related_searches" || type === "refinement_chips") {
        continue;
      }
      if (type && type !== "images_search" && type !== "images_element" && type !== "image") {
        continue;
      }
      const img = String(row.source_url || row.encoded_url || row.image_url || "").trim();
      if (!img || !/^https?:\/\//i.test(img)) continue;
      const pageUrl = String(row.url || "").trim();
      const title = String(row.title || row.subtitle || row.alt || "").trim();
      const alt = String(row.alt || row.title || "").trim();
      const rank =
        Number(row.rank_absolute || row.rank_group || items.length + 1) || items.length + 1;
      items.push({
        title,
        source_url: pageUrl || img,
        image_url: img,
        alt,
        rank,
      });
    }
  }

  const seen = new Set<string>();
  const deduped: GoogleImagesSerpItem[] = [];
  for (const it of items) {
    const key = it.image_url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(it);
  }

  deduped.sort((a, b) => a.rank - b.rank);
  return deduped;
}

export function canUseLocalInContentImage(sitemapSource: string | undefined | null): boolean {
  return (sitemapSource ?? "").trim().toLowerCase() === "sap";
}

/**
 * Place entity for Local Image Google search (never focus keyword / product phrase).
 * Uses existing geographic extractor; returns the place string verbatim.
 */
export async function resolveLocalImagePlaceEntity(params: {
  url?: string;
  title?: string;
  apiKey?: string;
}): Promise<string> {
  const { extractGeographicEntityWithAI } = await import(
    "@/lib/content-optimization/entity"
  );
  let slug: string | undefined;
  const url = (params.url ?? "").trim();
  if (url) {
    try {
      const path = new URL(url).pathname.replace(/\/+$/, "");
      const parts = path.split("/").filter(Boolean);
      slug = parts[parts.length - 1] || undefined;
    } catch {
      slug = undefined;
    }
  }
  const place = await extractGeographicEntityWithAI(
    {
      url: url || undefined,
      title: (params.title ?? "").trim() || undefined,
      slug,
    },
    params.apiKey,
  );
  const out = (place ?? "").trim();
  if (!out) {
    throw new Error(
      "Could not determine place entity for Local Image. Need a clear location in the page URL or title.",
    );
  }
  return out;
}
