import { loadApiKey } from "@/lib/api";
import { backendApiUrl } from "@/lib/wordpress-api/connection";

export type GoogleMapsImagePayload = {
  imageBase64: string;
  mimeType: string;
};

const cacheByEntityKey = new Map<string, GoogleMapsImagePayload>();
const inFlightByEntityKey = new Map<string, Promise<GoogleMapsImagePayload | null>>();

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

const MAX_ENTITY_MAP_ATTEMPTS = 5;
const ENTITY_MAP_RETRY_DELAY_MS = 2000;

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

function isTransientEntityMapError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("internal se server error") ||
    m.includes("timeout") ||
    m.includes("503") ||
    m.includes("502") ||
    m.includes("504")
  );
}

function entityMapRetryDelayMs(message: string, attempt: number): number {
  const base = isTransientEntityMapError(message) ? 4000 : ENTITY_MAP_RETRY_DELAY_MS;
  return base * attempt;
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

async function fetchGoogleMapsImageOnce(entity: string): Promise<GoogleMapsImagePayload> {
  const trimmed = entity.trim();
  if (!trimmed || trimmed === "N/A") {
    throw new Error("Missing entity for Google Maps image");
  }

  const openRouterApiKey = loadApiKey().trim();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (openRouterApiKey) {
    headers["X-OpenRouter-Api-Key"] = openRouterApiKey;
  }

  let lastError = "Failed to generate entity map image";
  for (let attempt = 1; attempt <= MAX_ENTITY_MAP_ATTEMPTS; attempt += 1) {
    const response = await fetch(backendApiUrl("/entity-maps-image/generate"), {
      method: "POST",
      headers,
      body: JSON.stringify({ entity: trimmed }),
    });

    if (!response.ok) {
      lastError = await parseEntityMapErrorResponse(response);
      if (attempt < MAX_ENTITY_MAP_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, entityMapRetryDelayMs(lastError, attempt)));
        continue;
      }
      throw new Error(lastError);
    }

    const result = await response.json();
    if (!result.success || !result.imageBase64) {
      lastError = result.error || "No image data returned from entity map image API";
      if (attempt < MAX_ENTITY_MAP_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, entityMapRetryDelayMs(lastError, attempt)));
        continue;
      }
      throw new Error(lastError);
    }

    let imageBase64 = String(result.imageBase64);
    const mimeType = String(result.mimeType || "image/jpeg");
    if (imageBase64.includes(",")) {
      imageBase64 = imageBase64.split(",")[1]!;
    }

    return { imageBase64, mimeType };
  }

  throw new Error(lastError);
}

export async function fetchGoogleMapsImageForEntity(
  entity: string,
): Promise<GoogleMapsImagePayload | null> {
  const trimmed = entity.trim();
  if (!trimmed || trimmed === "N/A") return null;

  const cached = peekGoogleMapsImageCache(trimmed);
  if (cached) return cached;

  const key = normalizeGoogleMapsEntityKey(trimmed);
  const inflight = inFlightByEntityKey.get(key);
  if (inflight) return inflight;

  const run = (async (): Promise<GoogleMapsImagePayload | null> => {
    const candidates = [
      trimmed,
      ...cityLabelsForEntity(trimmed).filter((label) => label !== trimmed),
    ];

    let lastError = "Failed to generate entity map image";
    for (const candidate of candidates) {
      try {
        const payload = await fetchGoogleMapsImageOnce(candidate);
        seedGoogleMapsImageCache(trimmed, payload);
        if (candidate !== trimmed) {
          seedGoogleMapsImageCache(candidate, payload);
        }
        return payload;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }
    }

    console.warn(`[Google Maps image] Failed for "${trimmed}": ${lastError}`);
    return null;
  })().finally(() => {
    inFlightByEntityKey.delete(key);
  });

  inFlightByEntityKey.set(key, run);
  return run;
}
