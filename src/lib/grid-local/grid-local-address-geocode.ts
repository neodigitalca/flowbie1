import { loadApiKey } from "@/lib/api";
import { callOpenRouterChatCompletion } from "@/lib/competitor-research/competitor-report-openrouter";
import { getResearchModel } from "@/lib/optimization-settings-storage";

const DEFAULT_GEOCODE_MODEL = "google/gemini-2.5-flash-lite";

function parseLatLngJson(raw: string): { lat: number; lng: number } {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const o = JSON.parse(cleaned) as { lat?: unknown; lng?: unknown };
  const lat = typeof o.lat === "number" ? o.lat : Number(o.lat);
  const lng = typeof o.lng === "number" ? o.lng : Number(o.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Model JSON missing valid lat/lng");
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error("Model returned out-of-range lat/lng");
  }
  return { lat, lng };
}

/** Geocode a Master Rules street address to WGS84 via OpenRouter (Gemini). */
export async function geocodeStreetAddressViaOpenRouter(
  formattedAddress: string,
  siteId?: string,
  signal?: AbortSignal,
): Promise<{ lat: number; lng: number }> {
  const apiKey = loadApiKey()?.trim();
  if (!apiKey) {
    throw new Error("OpenRouter API key required to geocode the Master Rules business address.");
  }
  const address = formattedAddress.trim();
  if (!address) {
    throw new Error("Master Rules business address is empty.");
  }

  const { content } = await callOpenRouterChatCompletion({
    apiKey,
    model: getResearchModel(siteId) || DEFAULT_GEOCODE_MODEL,
    system:
      "You geocode full street addresses to decimal GPS (WGS84). Return ONLY JSON with numeric lat and lng. Use the exact storefront location for the address given, not a city or postal centroid.",
    user: `Geocode this business address exactly as written:\n${address}\n\nReturn JSON: {"lat": number, "lng": number}`,
    maxTokens: 120,
    temperature: 0,
    responseFormat: { type: "json_object" },
    signal,
  });

  return parseLatLngJson(content);
}
