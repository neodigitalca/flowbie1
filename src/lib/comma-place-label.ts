/**
 * Comma-separated place labels (SAP entity, grid hints): avoid repeating the same place twice.
 */

function normalizeCommaPlacePart(p: string): string {
  return p.replace(/\s+/g, " ").trim().normalize("NFKC");
}

/**
 * Remove repeated comma-separated segments (case-insensitive), keeping the first occurrence.
 * Fixes e.g. "Stuart, Stuart, FL" → "Stuart, FL" when a hint was merged with a suffix that already included the city.
 * Normalizes whitespace and Unicode so visually identical city tokens (e.g. "Edmonton, Edmonton, AB") collapse.
 */
export function dedupeRepeatedCommaPlaceSegments(label: string): string {
  const parts = label
    .split(",")
    .map((p) => normalizeCommaPlacePart(p))
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const k = p.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out.join(", ");
}

/**
 * Drop a middle city segment when the leading neighbourhood/district already contains that city name
 * (e.g. "West Edmonton, Edmonton, AB" → "West Edmonton, AB").
 */
export function stripRedundantCityFromCommaPlaceLabel(label: string): string {
  const parts = label
    .split(",")
    .map((p) => normalizeCommaPlacePart(p))
    .filter(Boolean);
  if (parts.length < 3) return label.trim();
  const first = parts[0]!;
  const second = parts[1]!;
  if (first.toLowerCase().includes(second.toLowerCase())) {
    return dedupeRepeatedCommaPlaceSegments([first, ...parts.slice(2)].join(", "));
  }
  return label.trim();
}

/** SAP `entityHint` / comma-style place: strip duplicate city–region tokens (e.g. "Toronto, Toronto, ON" → "Toronto, ON"). */
export function normalizeEntityHintCommaLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;
  return stripRedundantCityFromCommaPlaceLabel(dedupeRepeatedCommaPlaceSegments(trimmed));
}

/**
 * Join a hyperlocal / hint segment with a city–region suffix without duplicating a leading place
 * already present in the suffix (e.g. hint "Stuart" + suffix "Stuart, FL" → "Stuart, FL").
 */
export function mergePlaceHintWithGeoSuffix(placeHint: string, geoSuffix: string): string {
  const hParts = placeHint
    .split(",")
    .map((p) => normalizeCommaPlacePart(p))
    .filter(Boolean);
  const gParts = geoSuffix
    .split(",")
    .map((p) => normalizeCommaPlacePart(p))
    .filter(Boolean);
  if (gParts.length === 0) return placeHint.trim();
  if (hParts.length === 0) return geoSuffix.trim();
  if (hParts.length <= gParts.length) {
    let prefix = true;
    for (let i = 0; i < hParts.length; i++) {
      if (hParts[i]!.toLowerCase() !== gParts[i]!.toLowerCase()) {
        prefix = false;
        break;
      }
    }
    if (prefix) {
      return gParts.join(", ");
    }
  }
  return dedupeRepeatedCommaPlaceSegments([...hParts, ...gParts].join(", "));
}
