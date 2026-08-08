import { loadApiKey } from "@/lib/api";
import { BACKEND_API_BASE } from "@/lib/wordpress-api/connection";

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
    const openRouterApiKey = loadApiKey().trim();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (openRouterApiKey) {
      headers["X-OpenRouter-Api-Key"] = openRouterApiKey;
    }

    const response = await fetch(`${BACKEND_API_BASE}/api/entity-maps-image/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify({ entity: trimmed }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Failed to generate entity map image" }));
      throw new Error(errorData.error || `HTTP ${response.status}: Failed to generate entity map image`);
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

    const payload: GoogleMapsImagePayload = { imageBase64, mimeType };
    seedGoogleMapsImageCache(trimmed, payload);
    return payload;
  })().finally(() => {
    inFlightByEntityKey.delete(key);
  });

  inFlightByEntityKey.set(key, run);
  return run;
}
