/**
 * Service-area radius filter: research model estimates lat/lng, haversine distance in miles.
 */

import { streamChatCompletion } from '@/lib/api';
import { getResearchModel } from '@/lib/optimization-settings-storage';
import type { RadiusDistancePreset } from '@/components/integrations/entity-generation/types';

export const RADIUS_PRESET_MILES: Record<Exclude<RadiusDistancePreset, 'off'>, number> = {
  close: 15,
  medium: 40,
  far: 75,
};

export function radiusPresetMaxMiles(preset: RadiusDistancePreset | undefined): number | null {
  if (!preset || preset === 'off') return null;
  return RADIUS_PRESET_MILES[preset];
}

export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const v = JSON.parse(cleaned) as Record<string, unknown>;
  if (!v || typeof v !== 'object') throw new Error('Invalid JSON from model');
  return v;
}

function parseJsonArray(raw: string): unknown[] {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const v = JSON.parse(cleaned);
  if (!Array.isArray(v)) throw new Error('Invalid JSON array from model');
  return v;
}

async function runOpenRouter(
  apiKey: string,
  siteId: string | undefined,
  system: string,
  user: string,
  maxTokens: number,
  signal?: AbortSignal
): Promise<string> {
  let out = '';
  await streamChatCompletion({
    apiKey,
    model: getResearchModel(siteId),
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.2,
    maxTokens,
    topP: 0.9,
    signal,
    onContentChunk: (chunk) => {
      out += chunk;
    },
  });
  return out.trim();
}

export interface ServiceAreaOrigin {
  label: string;
  lat: number;
  lng: number;
}

export async function geocodeServiceAreaOrigin(
  apiKey: string,
  siteId: string | undefined,
  siteName: string,
  siteUrl: string,
  primaryLocationLabel: string | null,
  onProgress?: (message: string) => void
): Promise<ServiceAreaOrigin> {
  const ctx = [
    siteName && `Site: ${siteName}`,
    siteUrl && `URL: ${siteUrl}`,
    primaryLocationLabel && `Primary service location: ${primaryLocationLabel}`,
  ]
    .filter(Boolean)
    .join('\n');
  const system = `You return ONLY valid JSON. Estimate the geographic center (lat/lng decimal degrees) for the business service area. North America: positive lat, negative lng west of prime meridian.`;
  const user = `${ctx || 'Unknown business'}\n\nReturn JSON: {"label":"string","lat":number,"lng":number}`;
  onProgress?.('Resolving service area coordinates...');
  const raw = await runOpenRouter(apiKey, siteId, system, user, 400);
  const o = parseJsonObject(raw);
  const label = typeof o.label === 'string' ? o.label : '';
  const lat = typeof o.lat === 'number' ? o.lat : Number(o.lat);
  const lng = typeof o.lng === 'number' ? o.lng : Number(o.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Service area geocode JSON missing valid lat/lng');
  }
  const disp = label || primaryLocationLabel || siteName || 'Service area';
  onProgress?.(`Service area: ${disp} (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
  return { label: disp, lat, lng };
}

async function geocodeEntityPlaces(
  apiKey: string,
  siteId: string | undefined,
  names: string[]
): Promise<Map<string, { lat: number; lng: number }>> {
  const system = `You return ONLY valid JSON array. For each place name, estimate coordinates (lat/lng decimal degrees). Copy each "entity" string exactly from the input.`;
  const user = `Places:\n${names.map((n) => `- ${n}`).join('\n')}\n\nReturn: [{"entity":"exact name","lat":number,"lng":number}, ...]`;
  const raw = await runOpenRouter(apiKey, siteId, system, user, 8000);
  const arr = parseJsonArray(raw);
  const map = new Map<string, { lat: number; lng: number }>();
  for (const row of arr) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const ent = typeof r.entity === 'string' ? r.entity.trim() : '';
    const lat = typeof r.lat === 'number' ? r.lat : Number(r.lat);
    const lng = typeof r.lng === 'number' ? r.lng : Number(r.lng);
    if (!ent || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    map.set(ent.toLowerCase(), { lat, lng });
  }
  return map;
}

const ENTITY_GEOCODE_CHUNK = 40;

export async function filterPoolByRadiusMiles(
  pool: Array<{ entity: string; wikipediaUrl: string }>,
  origin: ServiceAreaOrigin,
  maxMiles: number,
  apiKey: string,
  siteId: string | undefined,
  onProgress?: (message: string) => void,
  /** When set, stop after this many are kept within radius; pool should already be sized to the user’s requested count. */
  maxToKeep?: number
): Promise<Array<{ entity: string; wikipediaUrl: string }>> {
  const cap = maxToKeep != null && maxToKeep > 0 ? Math.min(maxToKeep, pool.length) : undefined;
  const kept: Array<{ entity: string; wikipediaUrl: string }> = [];
  for (let i = 0; i < pool.length; i += ENTITY_GEOCODE_CHUNK) {
    if (cap != null && kept.length >= cap) break;
    const chunk = pool.slice(i, i + ENTITY_GEOCODE_CHUNK);
    const names = chunk.map((p) => p.entity);
    onProgress?.(`Distance filter: places ${i + 1}–${i + chunk.length} of ${pool.length}...`);
    const coords = await geocodeEntityPlaces(apiKey, siteId, names);
    for (const p of chunk) {
      if (cap != null && kept.length >= cap) break;
      const c = coords.get(p.entity.trim().toLowerCase());
      if (!c) continue;
      const d = haversineMiles(origin.lat, origin.lng, c.lat, c.lng);
      if (d <= maxMiles) kept.push(p);
    }
  }
  onProgress?.(
    `Distance filter: ${kept.length} of ${pool.length} within ${maxMiles} mi.`
  );
  return kept;
}
