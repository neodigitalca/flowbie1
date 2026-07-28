const STORAGE_KEY_PREFIX = "flowbie_wp_master_instructions_";

export interface MasterInstructionsFileMeta {
  name: string;
  uploadedAt: number;
}

export type MasterInstructionSourceKind =
  | "pdf-summary"
  | "openrouter-section-summary"
  | "semantic-triples"
  | "gbp-address-json";

/** One uploaded document; content kept so files can be removed individually. */
export interface MasterInstructionSource extends MasterInstructionsFileMeta {
  content: string;
  /** AI-processed: legacy markdown, flat triples, or nested [subject] + predicate<TAB>object blocks. */
  kind?: MasterInstructionSourceKind;
  /** Character count of extracted text before AI summary (when kind is set). */
  originalExtractedChars?: number;
}

export interface MasterInstructionsPayload {
  sources: MasterInstructionSource[];
}

function emptyPayload(): MasterInstructionsPayload {
  return { sources: [] };
}

const TRIPLE_BLOCK_HINT =
  "Format: nested semantic triples. Each block: line [Subject], then predicate<TAB>object. Repeated predicates under one subject should be one line with object = item1; item2; item3 (semicolon-separated lists). \"# \" lines = section headers. Legacy flat subject<TAB>predicate<TAB>object may appear in old saves.";

const GBP_ADDRESS_JSON_HINT =
  "Format: GBP address JSON for client grounding (business name, address, city, region, phone, coordinates).";

function joinSources(sources: MasterInstructionSource[]): string {
  return sources
    .map((s) => {
      const body = s.content.trim();
      const head = `=== FILE: ${s.name} ===\n`;
      if (s.kind === "semantic-triples") {
        return `${head}${TRIPLE_BLOCK_HINT}\n\n${body}\n`;
      }
      if (s.kind === "gbp-address-json") {
        return `${head}${GBP_ADDRESS_JSON_HINT}\n\n${body}\n`;
      }
      return `${head}${body}\n`;
    })
    .join("\n")
    .trim();
}

/** Normalize sources for persistence (no content truncation). */
function normalizeSources(sources: MasterInstructionSource[]): MasterInstructionSource[] {
  return sources.map((s) => {
    const name = s.name.slice(0, 240);
    const row: MasterInstructionSource = {
      name,
      content: s.content,
      uploadedAt: s.uploadedAt,
    };
    if (s.kind === "pdf-summary") row.kind = "pdf-summary";
    if (s.kind === "openrouter-section-summary") row.kind = "openrouter-section-summary";
    if (s.kind === "semantic-triples") row.kind = "semantic-triples";
    if (s.kind === "gbp-address-json") row.kind = "gbp-address-json";
    if (typeof s.originalExtractedChars === "number") {
      row.originalExtractedChars = s.originalExtractedChars;
    }
    return row;
  });
}

/** Migrate legacy `{ text, files }` shape or loose API rows. */
function migrateRaw(parsed: unknown): MasterInstructionsPayload {
  if (!parsed || typeof parsed !== "object") return emptyPayload();
  const o = parsed as Record<string, unknown>;
  if (Array.isArray(o.sources)) {
    const sources = o.sources
      .filter(
        (x): x is MasterInstructionSource =>
          x &&
          typeof x === "object" &&
          typeof (x as MasterInstructionSource).name === "string" &&
          typeof (x as MasterInstructionSource).content === "string" &&
          typeof (x as MasterInstructionSource).uploadedAt === "number",
      )
      .map((s) => {
        const row: MasterInstructionSource = {
          name: s.name,
          content: s.content,
          uploadedAt: s.uploadedAt,
        };
        if (s.kind === "pdf-summary") row.kind = "pdf-summary";
        if (s.kind === "openrouter-section-summary") row.kind = "openrouter-section-summary";
        if (s.kind === "semantic-triples") row.kind = "semantic-triples";
        if (s.kind === "gbp-address-json") row.kind = "gbp-address-json";
        if (typeof s.originalExtractedChars === "number") {
          row.originalExtractedChars = s.originalExtractedChars;
        }
        return row;
      });
    return { sources: normalizeSources(sources) };
  }
  const text = typeof o.text === "string" ? o.text.trim() : "";
  if (text) {
    return {
      sources: normalizeSources([
        {
          name: "Imported instructions",
          content: text,
          uploadedAt: Date.now(),
        },
      ]),
    };
  }
  return emptyPayload();
}

function storageKey(siteId: string): string {
  return `${STORAGE_KEY_PREFIX}${siteId}`;
}

function readFromLocalStorage(siteId: string): MasterInstructionsPayload {
  if (typeof window === "undefined") return emptyPayload();
  try {
    const raw = localStorage.getItem(storageKey(siteId));
    if (!raw) return emptyPayload();
    return migrateRaw(JSON.parse(raw));
  } catch {
    return emptyPayload();
  }
}

function writeToLocalStorage(siteId: string, data: MasterInstructionsPayload): void {
  if (typeof window === "undefined") return;
  const normalized = { sources: normalizeSources(data.sources) };
  localStorage.setItem(storageKey(siteId), JSON.stringify(normalized));
}

/** In-memory override (unit tests only). */
const memoryBySite = new Map<string, MasterInstructionsPayload>();

/** Clears in-memory test overrides (e.g. on logout). Does not wipe localStorage. */
export function clearAllMasterInstructionsMemory(): void {
  memoryBySite.clear();
}

/** @internal Unit tests: seed cache without localStorage. */
export function seedMasterInstructionsForTests(siteId: string, payload: MasterInstructionsPayload): void {
  memoryBySite.set(siteId, { sources: normalizeSources(payload.sources) });
}

/** @internal Unit tests */
export function clearMasterInstructionsTestCache(): void {
  clearAllMasterInstructionsMemory();
}

/** No-op with local persistence (kept for callers). */
export function invalidateMasterInstructionsCache(_siteId: string): void {
  /* localStorage is source of truth */
}

/**
 * Loads per-site master instructions from browser localStorage.
 * @deprecated Name retained for callers; no cloud fetch.
 */
export async function loadMasterInstructionsFromCloud(siteId: string): Promise<MasterInstructionsPayload> {
  return getMasterInstructionsPayload(siteId);
}

/** No-op: localStorage reads are synchronous. */
export async function ensureMasterInstructionsInMemory(_siteId: string | null | undefined): Promise<void> {
  /* local reads need no prefetch */
}

export function getMasterInstructionsPayload(siteId: string | undefined | null): MasterInstructionsPayload {
  if (!siteId || typeof window === "undefined") return emptyPayload();
  const mem = memoryBySite.get(siteId);
  if (mem) return mem;
  return readFromLocalStorage(siteId);
}

export function getMasterInstructionsText(siteId: string | undefined | null): string {
  const { sources } = getMasterInstructionsPayload(siteId);
  if (sources.length === 0) return "";
  return joinSources(sources);
}

export async function setMasterInstructions(siteId: string, data: MasterInstructionsPayload): Promise<void> {
  if (typeof window === "undefined") return;
  const normalized = { sources: normalizeSources(data.sources) };
  try {
    writeToLocalStorage(siteId, normalized);
    memoryBySite.delete(siteId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[MasterInstructions] Failed to save:", e);
    throw new Error(msg || "Failed to save master instructions");
  }
}

export async function clearMasterInstructions(siteId: string): Promise<void> {
  if (typeof window === "undefined") return;
  localStorage.removeItem(storageKey(siteId));
  memoryBySite.delete(siteId);
}

const BLOCK_START =
  "\n\n=== CLIENT MASTER INSTRUCTIONS (MANDATORY - OVERRIDES CONFLICTING DEFAULTS) ===\n";
const BLOCK_END = "\n=== END CLIENT MASTER INSTRUCTIONS ===\n";

const MASTER_RULES_CITY_PREDICATES = new Set(["city", "locality", "address_city", "located_in_city"]);
const MASTER_RULES_REGION_PREDICATES = new Set([
  "region",
  "province",
  "state",
  "administrative_area",
  "administrative_area_level_1",
]);

function firstTripleObjectValue(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const semi = t.indexOf(";");
  return (semi >= 0 ? t.slice(0, semi) : t).trim();
}

/** Best-effort city/region from saved Master Rules (GBP triples or gbp-address-json). */
export function cityRegionFromMasterInstructions(
  siteId: string | undefined | null,
): { city: string; region: string } {
  const { sources } = getMasterInstructionsPayload(siteId);
  for (const s of sources) {
    if (s.kind !== "gbp-address-json") continue;
    try {
      const parsed = JSON.parse(s.content.trim()) as Record<string, unknown>;
      const city = typeof parsed.city === "string" ? parsed.city.trim() : "";
      const region = typeof parsed.region === "string" ? parsed.region.trim() : "";
      if (city) return { city, region };
    } catch {
      /* ignore */
    }
  }

  let city = "";
  let region = "";
  for (const s of sources) {
    const body = s.content.trim();
    if (!body) continue;
    for (const line of body.split(/\r?\n/)) {
      const tab = line.indexOf("\t");
      if (tab < 0) continue;
      const pred = line.slice(0, tab).trim().toLowerCase();
      const obj = firstTripleObjectValue(line.slice(tab + 1));
      if (!obj) continue;
      if (!city && MASTER_RULES_CITY_PREDICATES.has(pred)) city = obj;
      if (!region && MASTER_RULES_REGION_PREDICATES.has(pred)) region = obj;
    }
    if (city) break;
  }
  return { city, region };
}

const GBP_MASTER_RULES_FILENAME = "GBP-business-gbp.txt";

const MASTER_RULES_NAME_PREDICATES = new Set([
  "name",
  "business_name",
  "business name",
  "businessname",
  "title",
  "legal_name",
  "gbp_name",
]);
const MASTER_RULES_LAT_PREDICATES = new Set([
  "latitude",
  "lat",
  "gps_latitude",
  "geo_lat",
  "geo_latitude",
]);
const MASTER_RULES_LNG_PREDICATES = new Set([
  "longitude",
  "lng",
  "lon",
  "gps_longitude",
  "geo_lng",
  "geo_longitude",
]);
const MASTER_RULES_COORD_PAIR_PREDICATES = new Set([
  "gps_coordinates",
  "coordinates",
  "coordinate",
  "geo",
  "location_coordinate",
  "lat_lng",
  "latlng",
]);
const MASTER_RULES_PLACE_ID_PREDICATES = new Set(["place_id", "place id", "placeid"]);
const MASTER_RULES_CID_PREDICATES = new Set(["cid"]);
const MASTER_RULES_POSTAL_PREDICATES = new Set([
  "postal_code",
  "postal code",
  "postalcode",
  "zip",
  "zip_code",
  "zip code",
  "postcode",
]);
const MASTER_RULES_ADDRESS_PREDICATES = new Set([
  "address",
  "street_address",
  "street address",
  "formatted_address",
  "formatted address",
]);
const MASTER_RULES_COUNTRY_PREDICATES = new Set(["country", "country_code", "country code"]);

function tripleNum(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function isGbpMasterRulesFilename(name: string): boolean {
  return name.trim().toLowerCase() === GBP_MASTER_RULES_FILENAME.toLowerCase();
}

function findGbpMasterRulesSource(sources: MasterInstructionSource[]): MasterInstructionSource | null {
  return (
    sources.find((s) => isGbpMasterRulesFilename(s.name)) ??
    sources.find((s) => s.name.toLowerCase().includes("gbp-business-gbp")) ??
    null
  );
}

function applyCoordPair(
  raw: string,
  latitude: number | null,
  longitude: number | null,
): { latitude: number | null; longitude: number | null } {
  if (latitude != null && longitude != null) return { latitude, longitude };
  const sep = raw.includes(",") ? "," : raw.includes(";") ? ";" : "";
  const bits = sep ? raw.split(sep).map((p) => p.trim()).filter(Boolean) : [raw.trim()];
  if (bits.length < 2) return { latitude, longitude };
  const la = tripleNum(bits[0]);
  const ln = tripleNum(bits[1]);
  return {
    latitude: latitude ?? la,
    longitude: longitude ?? ln,
  };
}

function applyBracketSubjectName(state: { businessName: string }, line: string): void {
  const match = line.trim().match(/^\[([^\]]+)\]/);
  if (!match) return;
  const subject = match[1].replace(/\s*-\s*entity\/topic\s*$/i, "").trim();
  if (!subject) return;
  if (/^(business|location|address)$/i.test(subject)) return;
  const hasColon = subject.includes(":");
  const cur = state.businessName;
  if (!cur) {
    state.businessName = subject;
    return;
  }
  const curHasColon = cur.includes(":");
  if (curHasColon && !hasColon) {
    state.businessName = subject;
    return;
  }
  if (!curHasColon && hasColon) return;
  if (subject.length < cur.length) state.businessName = subject;
}

function applyPredicateValue(
  pred: string,
  obj: string,
  state: {
    businessName: string;
    latitude: number | null;
    longitude: number | null;
    placeId: string | null;
    cid: string | null;
    city: string;
    region: string;
    postalCode: string;
    address: string;
    country: string;
  },
): void {
  if (!pred || !obj) return;
  if (MASTER_RULES_NAME_PREDICATES.has(pred)) state.businessName = obj;
  if (state.latitude == null && MASTER_RULES_LAT_PREDICATES.has(pred)) state.latitude = tripleNum(obj);
  if (state.longitude == null && MASTER_RULES_LNG_PREDICATES.has(pred)) {
    state.longitude = tripleNum(obj);
  }
  if (MASTER_RULES_COORD_PAIR_PREDICATES.has(pred)) {
    const pair = applyCoordPair(obj, state.latitude, state.longitude);
    state.latitude = pair.latitude;
    state.longitude = pair.longitude;
  }
  if (!state.placeId && MASTER_RULES_PLACE_ID_PREDICATES.has(pred)) state.placeId = obj;
  if (!state.cid && MASTER_RULES_CID_PREDICATES.has(pred)) state.cid = obj;
  if (!state.city && MASTER_RULES_CITY_PREDICATES.has(pred)) state.city = obj;
  if (!state.region && MASTER_RULES_REGION_PREDICATES.has(pred)) state.region = obj;
  if (!state.postalCode && MASTER_RULES_POSTAL_PREDICATES.has(pred)) state.postalCode = obj;
  if (!state.address && MASTER_RULES_ADDRESS_PREDICATES.has(pred)) state.address = obj;
  if (!state.country && MASTER_RULES_COUNTRY_PREDICATES.has(pred)) state.country = obj;
}

function collectGbpFromJsonNode(
  node: unknown,
  state: {
    businessName: string;
    latitude: number | null;
    longitude: number | null;
    placeId: string | null;
    cid: string | null;
    city: string;
    region: string;
    postalCode: string;
    address: string;
    country: string;
  },
  depth = 0,
): void {
  if (node == null || depth > 12) return;
  if (Array.isArray(node)) {
    for (const item of node) collectGbpFromJsonNode(item, state, depth + 1);
    return;
  }
  if (typeof node !== "object") return;
  const o = node as Record<string, unknown>;

  if (!state.businessName) {
    if (typeof o.title === "string" && o.title.trim()) state.businessName = o.title.trim();
    else if (typeof o.businessName === "string" && o.businessName.trim()) {
      state.businessName = o.businessName.trim();
    } else if (typeof o.name === "string" && o.name.trim()) state.businessName = o.name.trim();
  }

  if (state.latitude == null) {
    state.latitude =
      tripleNum(String(o.latitude ?? "")) ??
      tripleNum(String(o.lat ?? "")) ??
      null;
  }
  if (state.longitude == null) {
    state.longitude =
      tripleNum(String(o.longitude ?? "")) ??
      tripleNum(String(o.lng ?? "")) ??
      null;
  }

  const gps = o.gps_coordinates;
  if (gps && typeof gps === "object") {
    const g = gps as Record<string, unknown>;
    if (state.latitude == null) state.latitude = tripleNum(String(g.latitude ?? ""));
    if (state.longitude == null) state.longitude = tripleNum(String(g.longitude ?? ""));
  }

  if (!state.placeId && typeof o.place_id === "string" && o.place_id.trim()) {
    state.placeId = o.place_id.trim();
  }
  if (!state.cid && o.cid != null) {
    const c = String(o.cid).trim();
    if (c) state.cid = c;
  }

  if (!state.city && typeof o.city === "string" && o.city.trim()) state.city = o.city.trim();
  if (!state.region && typeof o.region === "string" && o.region.trim()) state.region = o.region.trim();
  if (!state.postalCode && typeof o.postalCode === "string" && o.postalCode.trim()) {
    state.postalCode = o.postalCode.trim();
  }
  if (!state.address && typeof o.formattedAddress === "string" && o.formattedAddress.trim()) {
    state.address = o.formattedAddress.trim();
  }
  if (!state.address && typeof o.address === "string" && o.address.trim()) state.address = o.address.trim();
  if (!state.country && typeof o.country === "string" && o.country.trim()) state.country = o.country.trim();

  for (const v of Object.values(o)) collectGbpFromJsonNode(v, state, depth + 1);
}

function tryParseEmbeddedJson(body: string): unknown | null {
  const trimmed = body.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function parseGbpTriplesBody(body: string): {
  businessName: string;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  cid: string | null;
  city: string;
  region: string;
  postalCode: string;
  address: string;
  country: string;
} {
  const state = {
    businessName: "",
    latitude: null as number | null,
    longitude: null as number | null,
    placeId: null as string | null,
    cid: null as string | null,
    city: "",
    region: "",
    postalCode: "",
    address: "",
    country: "",
  };

  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    if (trimmed.startsWith("[")) {
      applyBracketSubjectName(state, trimmed);
      continue;
    }

    const coordPrefix = "- Coordinates:";
    if (trimmed.startsWith(coordPrefix)) {
      const pair = applyCoordPair(trimmed.slice(coordPrefix.length), state.latitude, state.longitude);
      state.latitude = pair.latitude;
      state.longitude = pair.longitude;
      continue;
    }

    const tab = line.indexOf("\t");
    if (tab >= 0) {
      const parts = line.split("\t");
      if (parts.length >= 3) {
        applyPredicateValue(parts[1].trim().toLowerCase(), parts.slice(2).join("\t").trim(), state);
      } else {
        applyPredicateValue(line.slice(0, tab).trim().toLowerCase(), line.slice(tab + 1).trim(), state);
      }
      continue;
    }

    const colon = trimmed.indexOf(":");
    if (colon > 0) {
      applyPredicateValue(
        trimmed.slice(0, colon).trim().toLowerCase(),
        trimmed.slice(colon + 1).trim(),
        state,
      );
    }
  }

  const embedded = tryParseEmbeddedJson(body);
  if (embedded) collectGbpFromJsonNode(embedded, state);

  return state;
}

function groundingFromParsed(state: {
  businessName: string;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  cid: string | null;
  city?: string;
  region?: string;
  postalCode?: string;
  address?: string;
}): GbpMasterRulesGrounding | null {
  if (state.latitude == null || state.longitude == null) return null;
  if (!state.businessName.trim()) return null;
  return {
    businessName: state.businessName.trim(),
    latitude: state.latitude,
    longitude: state.longitude,
    placeId: state.placeId,
    cid: state.cid,
  };
}

function groundingFromParsedAllowMissingName(state: {
  businessName: string;
  latitude: number | null;
  longitude: number | null;
  placeId: string | null;
  cid: string | null;
  city?: string;
  region?: string;
  postalCode?: string;
  address?: string;
}): Pick<GbpMasterRulesGrounding, "latitude" | "longitude" | "placeId" | "cid"> & {
  businessName: string;
} | null {
  if (state.latitude == null || state.longitude == null) return null;
  return {
    businessName: state.businessName.trim(),
    latitude: state.latitude,
    longitude: state.longitude,
    placeId: state.placeId,
    cid: state.cid,
  };
}

export function gbpGroundingFailureReason(siteId: string | undefined | null): string {
  const { sources } = getMasterInstructionsPayload(siteId);
  const gbp = findGbpMasterRulesSource(sources);
  if (!gbp) {
    return `No GBP-business-gbp.txt on this property (${sources.length} Master Rules file(s)).`;
  }
  const parsed = parseGbpTriplesBody(gbp.content);
  const missing: string[] = [];
  if (parsed.latitude == null || parsed.longitude == null) missing.push("latitude/longitude");
  if (!parsed.businessName.trim()) missing.push("business name");
  if (missing.length === 0) return `GBP-business-gbp.txt found (${gbp.content.length} chars) but could not build grounding.`;
  return `GBP-business-gbp.txt found (${gbp.content.length} chars) but missing ${missing.join(" and ")}.`;
}

export type GbpMasterRulesGrounding = {
  businessName: string;
  latitude: number;
  longitude: number;
  placeId: string | null;
  cid: string | null;
};

/** GBP name + coordinates from Master Rules `GBP-business-gbp.txt` (no live DataForSEO). */
export function gbpGroundingFromMasterInstructions(
  siteId: string | undefined | null,
): GbpMasterRulesGrounding | null {
  const { sources } = getMasterInstructionsPayload(siteId);
  const gbpFile = findGbpMasterRulesSource(sources);
  const ordered = gbpFile
    ? [gbpFile]
    : [
        ...sources.filter((s) => s.kind === "gbp-address-json"),
        ...sources.filter((s) => s.kind === "semantic-triples"),
      ];

  for (const s of ordered) {
    const body = s.content.trim();
    if (!body) continue;

    if (s.kind === "gbp-address-json") {
      try {
        const parsed = JSON.parse(body) as Record<string, unknown>;
        const businessName =
          (typeof parsed.businessName === "string" && parsed.businessName.trim()) ||
          (typeof parsed.name === "string" && parsed.name.trim()) ||
          "";
        const latitude =
          typeof parsed.latitude === "number"
            ? parsed.latitude
            : typeof parsed.lat === "number"
              ? parsed.lat
              : null;
        const longitude =
          typeof parsed.longitude === "number"
            ? parsed.longitude
            : typeof parsed.lng === "number"
              ? parsed.lng
              : null;
        const hit = groundingFromParsed({
          businessName,
          latitude,
          longitude,
          placeId: typeof parsed.placeId === "string" ? parsed.placeId.trim() : null,
          cid: parsed.cid != null ? String(parsed.cid).trim() : null,
          city: typeof parsed.city === "string" ? parsed.city.trim() : "",
          region: typeof parsed.region === "string" ? parsed.region.trim() : "",
          postalCode: typeof parsed.postalCode === "string" ? parsed.postalCode.trim() : "",
          address:
            (typeof parsed.formattedAddress === "string" && parsed.formattedAddress.trim()) ||
            (typeof parsed.address === "string" && parsed.address.trim()) ||
            "",
        });
        if (hit) return hit;
      } catch {
        /* try triples below */
      }
    }

    const triples = parseGbpTriplesBody(body);
    const hit = groundingFromParsed(triples);
    if (hit) return hit;
  }

  return null;
}

/** Coords from Master Rules; business name may be filled by caller from NAP. */
export function gbpCoordsFromMasterInstructions(
  siteId: string | undefined | null,
): Pick<GbpMasterRulesGrounding, "latitude" | "longitude" | "placeId" | "cid" | "businessName"> | null {
  const { sources } = getMasterInstructionsPayload(siteId);
  const gbpFile = findGbpMasterRulesSource(sources);
  if (!gbpFile) return null;
  return groundingFromParsedAllowMissingName(parseGbpTriplesBody(gbpFile.content));
}

export type GbpGridAddressFields = {
  address: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
};

function addressLineLooksComplete(street: string, city: string, postal: string): boolean {
  const norm = street.toLowerCase();
  const cityTrim = city.trim();
  if (cityTrim && norm.includes(cityTrim.toLowerCase())) return true;
  const pc = postal.trim().replace(/\s+/g, "").toLowerCase();
  if (pc && norm.replace(/\s+/g, "").includes(pc)) return true;
  return street.includes(",") && street.split(",").length >= 2;
}

/** Build one full address line from GBP Master Rules for OpenRouter geocoding (any site). */
export function formatGbpMasterRulesAddressForGeocode(gbp: GbpGridAddressFields): string {
  const street = gbp.address?.trim() ?? "";
  const city = gbp.city?.trim() ?? "";
  const region = gbp.region?.trim() ?? "";
  const postal = gbp.postalCode?.trim() ?? "";
  const country = gbp.country?.trim() ?? "";

  if (street && addressLineLooksComplete(street, city, postal)) {
    if (country && !street.toLowerCase().includes(country.toLowerCase())) {
      return `${street}, ${country}`;
    }
    return street;
  }

  const locality = [city, region, postal].filter(Boolean).join(" ");
  return [street, locality, country].filter(Boolean).join(", ");
}

export function hasGbpMasterRulesAddressForGeocode(gbp: GbpGridAddressFields): boolean {
  const street = gbp.address?.trim();
  if (!street) return false;
  if (gbp.city?.trim() || gbp.postalCode?.trim() || gbp.region?.trim()) return true;
  return addressLineLooksComplete(street, "", gbp.postalCode);
}

/** City, region, postal, address, and business name from GBP-business-gbp.txt for Grid Local. */
export function gbpGridContextFromMasterInstructions(
  siteId: string | undefined | null,
): {
  businessName: string;
  city: string;
  region: string;
  postalCode: string;
  address: string;
  country: string;
  placeId: string | null;
  cid: string | null;
} | null {
  const { sources } = getMasterInstructionsPayload(siteId);
  const gbpFile = findGbpMasterRulesSource(sources);
  if (!gbpFile?.content.trim()) return null;
  const parsed = parseGbpTriplesBody(gbpFile.content);
  if (!parsed.city && !parsed.region && !parsed.postalCode && !parsed.address) return null;
  return {
    businessName: parsed.businessName,
    city: parsed.city,
    region: parsed.region,
    postalCode: parsed.postalCode,
    address: parsed.address,
    country: parsed.country,
    placeId: parsed.placeId,
    cid: parsed.cid,
  };
}

/** @deprecated Use gbpGridContextFromMasterInstructions */
export function gbpPlaceHintFromMasterInstructions(
  siteId: string | undefined | null,
): { city: string; region: string; postalCode: string; address: string } | null {
  const ctx = gbpGridContextFromMasterInstructions(siteId);
  if (!ctx) return null;
  return {
    city: ctx.city,
    region: ctx.region,
    postalCode: ctx.postalCode,
    address: ctx.address,
  };
}

export function gbpGridPlaceFailureReason(siteId: string | undefined | null): string {
  const { sources } = getMasterInstructionsPayload(siteId);
  const gbp = findGbpMasterRulesSource(sources);
  if (!gbp) {
    return `No GBP-business-gbp.txt on this property (${sources.length} Master Rules file(s)). Upload it in Dashboard → Master Rules.`;
  }
  const parsed = parseGbpTriplesBody(gbp.content);
  const hasCoords = parsed.latitude != null && parsed.longitude != null;
  const fields = {
    address: parsed.address,
    city: parsed.city,
    region: parsed.region,
    postalCode: parsed.postalCode,
    country: parsed.country,
  };
  const hasAddress = hasGbpMasterRulesAddressForGeocode(fields);
  if (!hasCoords && !hasAddress) {
    return `GBP-business-gbp.txt found (${gbp.content.length} chars) but missing street address + city/postal (or latitude/longitude) for grid center.`;
  }
  const label = formatGbpMasterRulesAddressForGeocode(fields) || parsed.address?.trim() || parsed.city;
  return `GBP-business-gbp.txt address (${label}) could not be geocoded. Check Master Rules and your OpenRouter API key.`;
}

export function hasMasterInstructions(siteId?: string | null): boolean {
  return getMasterInstructionsText(siteId).length > 0;
}

/** Prepended to SAP suggest/generate system prompts when per-site Master Rules exist. */
export function buildSapMasterRulesWorkflowPrefix(siteId?: string | null): string {
  if (!hasMasterInstructions(siteId)) return "";
  return `**CLIENT MASTER INSTRUCTIONS (read first):** When the **CLIENT MASTER INSTRUCTIONS** block appears at the end of this system message, it is the **source of truth** for **keyword theme mix**, **percentage splits across service lines** (e.g. 60%/40%), **SAP counts per theme**, and **service focus**. Apply those rules **exactly** across every \`keyword\` / \`seedKeyword\` you output. **Do not** default every row to one theme from post inventory, grid dominance, or optional **focusKeyword** when Master Rules specify a split. **Keyword strings stay geography-free** (no city, state, neighbourhood, landmark, or postal tokens in \`keyword\`); place names belong in \`entityHint\` / \`entity\` only. Use grid weakness weights, optional focusKeyword, and default allocation rules **only when** Master Rules are silent on those topics. `;
}

/** Mid-prompt recap when Master Rules exist (suggest + SAP generate). */
export function buildSapMasterRulesKeywordMixRecap(siteId?: string | null): string {
  if (!hasMasterInstructions(siteId)) return "";
  return `**Keyword theme mix (Master Rules):** Read **CLIENT MASTER INSTRUCTIONS** at the end of this message for **percentage splits** and **service-line themes**. Apply those ratios **across the full batch** of \`keyword\` / \`seedKeyword\` strings (count seeds and members). **Forbidden:** assigning one dominant theme to every row when Master Rules specify a split. **Forbidden:** city, state, neighbourhood, landmark, or postal tokens inside \`keyword\` (geography belongs in \`entityHint\` / \`entity\` only). Optional **focusKeyword** in the JSON payload and published-content samples are **secondary** when Master Rules define theme mix. Use grid weakness weights for SAP counts **only when** Master Rules are silent on allocation.`;
}

/** Suggest-only: distinct clusters must follow Master Rules theme caps, not one repeated seed. */
export function buildSapMasterRulesDistinctClustersBlock(siteId?: string | null): string {
  if (!hasMasterInstructions(siteId)) return "";
  return `**Multiple clusters + Master Rules (non-negotiable):** Each cluster is a **distinct service-line theme**, not the same \`seedKeyword\` repeated with different geography. **Count every \`seedKeyword\` and \`members[].keyword\` in the response.** Apply CLIENT MASTER INSTRUCTIONS percentage caps to that full count (e.g. if rules cap a theme at 60%, at most 60% of those strings may use that theme's phrasing). **Forbidden:** using the grid's dominant tracked keyword as every cluster's \`seedKeyword\`. **Forbidden:** reusing the same \`seedKeyword\` on multiple clusters. **Required:** clusters (and member keywords) for each non-dominant theme Master Rules specify. \`clusterId\` must be **unique per cluster** (short opaque id), not one theme label reused for every cluster.`;
}

export function appendMasterInstructionsToSystemPrompt(
  systemPrompt: string,
  siteId?: string | null,
): string {
  const extra = getMasterInstructionsText(siteId);
  if (!extra) return systemPrompt;
  return `${systemPrompt}${BLOCK_START}${extra}${BLOCK_END}`;
}
