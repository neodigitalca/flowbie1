import { loadApiKey } from "@/lib/api";

export type GoogleMapsImagePayload = {
  imageBase64: string;
  mimeType: string;
  referenceImageBase64?: string;
};

const cacheByEntityKey = new Map<string, GoogleMapsImagePayload>();
const inFlightByEntityKey = new Map<string, Promise<GoogleMapsImagePayload>>();

export function normalizeGoogleMapsEntityKey(entity: string): string {
  return entity.trim().toLowerCase();
}

export function peekGoogleMapsImageCache(entity: string): GoogleMapsImagePayload | null {
  const key = normalizeGoogleMapsEntityKey(entity);
  if (!key || key === "n/a") return null;
  return cacheByEntityKey.get(key) ?? null;
}

export function seedGoogleMapsImageCache(entity: string, payload: GoogleMapsImagePayload): void {
  const key = normalizeGoogleMapsEntityKey(entity);
  if (!key || key === "n/a") return;
  cacheByEntityKey.set(key, payload);
}

export function clearGoogleMapsImageSessionCache(): void {
  cacheByEntityKey.clear();
  inFlightByEntityKey.clear();
}

const POI_SUFFIXES = [
  "Community Centre",
  "Recreation Centre",
  "Community Center",
  "Recreation Center",
  "Shopping Centre",
  "Shopping Center",
  "Medical Centre",
  "Medical Center",
  "Hospital",
  "Library",
  "School",
  "Arena",
  "Mall",
  "Park",
  "Centre",
  "Center",
] as const;

function stripPoiSuffixFromLabel(label: string): string {
  const trimmed = label.trim();
  for (const suffix of POI_SUFFIXES) {
    const pattern = new RegExp(`\\s+${suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "iu");
    const stripped = trimmed.replace(pattern, "").trim();
    if (stripped && stripped !== trimmed) return stripped;
  }
  return trimmed;
}

function isRegionCodeLabel(label: string): boolean {
  return /^[A-Z]{2}$/i.test(label.trim());
}

/** City-level labels when a POI/region entity has no map rectangle in SERP. */
export function cityLabelsForEntity(entity: string): string[] {
  const trimmed = entity.trim();
  if (!trimmed) return [];

  const labels: string[] = [];
  const add = (label: string) => {
    const value = label.trim();
    if (value && !labels.includes(value)) labels.push(value);
  };

  const parts = trimmed.split(",").map((part) => part.trim()).filter(Boolean);
  const count = parts.length;

  if (count >= 3) {
    add(`${parts[1]}, ${parts[2]}`);
    return labels;
  }

  if (count === 2) {
    const stripped = stripPoiSuffixFromLabel(parts[0]!);
    if (stripped) add(`${stripped}, ${parts[1]}`);
    if (!isRegionCodeLabel(parts[1]!)) {
      add(parts[1]!);
    } else if (stripped && stripped.localeCompare(parts[0]!, undefined, { sensitivity: "accent" }) !== 0) {
      add(stripped);
    }
  }

  return labels;
}

async function parseEntityMapErrorResponse(response: Response): Promise<string> {
  const text = await response.text();
  if (!text.trim()) {
    return `HTTP ${response.status}: Failed to generate entity map image`;
  }
  try {
    const errorData = JSON.parse(text) as { error?: string; message?: string };
    return errorData.error || errorData.message || `HTTP ${response.status}: Failed to generate entity map image`;
  } catch {
    return text.length > 240 ? `${text.slice(0, 240)}…` : text;
  }
}

async function generateGoogleMapsImageViaApi(entity: string): Promise<GoogleMapsImagePayload> {
  const trimmed = entity.trim();
  if (!trimmed || trimmed === "N/A") {
    throw new Error("Missing entity for Google Maps image");
  }

  const openRouterApiKey = loadApiKey().trim();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (openRouterApiKey) {
    headers["X-OpenRouter-Api-Key"] = openRouterApiKey;
  }

  const response = await fetch("/api/entity-maps-image/generate", {
    method: "POST",
    headers,
    body: JSON.stringify({ entity: trimmed }),
  });

  if (!response.ok) {
    throw new Error(await parseEntityMapErrorResponse(response));
  }

  const result = await response.json();
  if (!result.success || !result.imageBase64) {
    throw new Error(result.error || "No image data returned from entity map image API");
  }

  let imageBase64 = String(result.imageBase64);
  const mimeType = String(result.mimeType || "image/jpeg");
  if (imageBase64.includes(",")) {
    imageBase64 = imageBase64.split(",")[1]!;
  }

  let referenceImageBase64 = result.referencePngBase64
    ? String(result.referencePngBase64)
    : undefined;
  if (referenceImageBase64?.includes(",")) {
    referenceImageBase64 = referenceImageBase64.split(",")[1];
  }

  return { imageBase64, mimeType, referenceImageBase64 };
}

/** Fire the Google Image fetch now. Do not await. Later awaits share this in-flight promise. */
export function startGoogleMapsImageForEntity(entity: string): void {
  const trimmed = entity.trim();
  if (!trimmed || trimmed === "N/A") return;
  void fetchGoogleMapsImageForEntityWithFallback(trimmed);
}

export function startGoogleMapsImageForRow(
  row: { entity?: string; featuredImage?: string },
  featuredImageType?: string,
): void {
  const entity = row.entity?.trim();
  if (!entity || entity === "N/A" || row.featuredImage === "n") return;
  if (row.featuredImage === "google-maps" || featuredImageType === "google-maps") {
    startGoogleMapsImageForEntity(entity);
  }
}

export function startGoogleMapsImagesForRows(
  rows: Array<{ entity?: string; featuredImage?: string }>,
  featuredImageType?: string,
): void {
  const seen = new Set<string>();
  for (const row of rows) {
    const entity = row.entity?.trim();
    if (!entity || entity === "N/A" || row.featuredImage === "n") continue;
    if (row.featuredImage !== "google-maps" && featuredImageType !== "google-maps") continue;
    const key = normalizeGoogleMapsEntityKey(entity);
    if (seen.has(key)) continue;
    seen.add(key);
    startGoogleMapsImageForEntity(entity);
  }
}

export function buildGoogleMapsImageLabelCandidates(
  entity: string,
  serpLocation?: string,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (label: string) => {
    const value = label.trim();
    if (!value || value === "N/A") return;
    const key = normalizeGoogleMapsEntityKey(value);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(value);
  };

  add(entity);
  for (const city of cityLabelsForEntity(entity)) add(city);
  if (serpLocation) add(serpLocation);

  return out;
}

async function fetchGoogleMapsImageForLabelsInternal(
  labels: string[],
  cacheUnderEntity: string,
): Promise<GoogleMapsImagePayload | null> {
  const cached = peekGoogleMapsImageCache(cacheUnderEntity);
  if (cached) return cached;

  for (const label of labels) {
    const labelCached = peekGoogleMapsImageCache(label);
    if (labelCached) {
      seedGoogleMapsImageCache(cacheUnderEntity, labelCached);
      return labelCached;
    }
    try {
      const payload = await generateGoogleMapsImageViaApi(label);
      seedGoogleMapsImageCache(cacheUnderEntity, payload);
      seedGoogleMapsImageCache(label, payload);
      return payload;
    } catch {
      // try next label
    }
  }
  return null;
}

/** Entity first, city / SERP location second — silent label retries. */
export async function fetchGoogleMapsImageForEntityWithFallback(
  entity: string,
  serpLocation?: string,
): Promise<GoogleMapsImagePayload | null> {
  const trimmed = entity.trim();
  if (!trimmed || trimmed === "N/A") return null;

  const labels = buildGoogleMapsImageLabelCandidates(trimmed, serpLocation);
  if (!labels.length) return null;

  const key = normalizeGoogleMapsEntityKey(trimmed);
  const inflight = inFlightByEntityKey.get(key);
  if (inflight) {
    try {
      return await inflight;
    } catch {
      return null;
    }
  }

  const run = fetchGoogleMapsImageForLabelsInternal(labels, trimmed).finally(() => {
    inFlightByEntityKey.delete(key);
  });

  inFlightByEntityKey.set(key, run as Promise<GoogleMapsImagePayload>);
  return run;
}

export async function fetchGoogleMapsImageForEntity(entity: string): Promise<GoogleMapsImagePayload> {
  return generateGoogleMapsImageViaApi(entity);
}
