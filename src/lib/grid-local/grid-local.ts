import type { WordPressSite } from "@/components/integrations/types";
import {
  gbpGridContextFromMasterInstructions,
  gbpGridPlaceFailureReason,
  formatGbpMasterRulesAddressForGeocode,
  hasGbpMasterRulesAddressForGeocode,
} from "@/lib/master-instructions-storage";
import { fetchGridLocalMapsSerpBatch } from "@/lib/grid-local/grid-local-dfs-batch";
import { geocodeStreetAddressViaOpenRouter } from "@/lib/grid-local/grid-local-address-geocode";
import { fetchLocalStrategyGmbDfsRaw } from "@/lib/local-strategy-research/local-strategy-gmb-fetch";
import { extractGmbDfsPlaceIdentifiers } from "@/lib/gmb-dfs-parse";
import { wordpressSiteDisplayName } from "@/lib/wordpress-site-display-name";

export type GridLocalSerpRow = {
  rank: number;
  title: string;
  placeId?: string | null;
  cid?: string | null;
};

export type GridLocalPin = {
  lat: number;
  lng: number;
  rank: number | null;
  serp?: GridLocalSerpRow[];
  scannedAt?: string;
  isCenter?: boolean;
  /** DataForSEO location_coordinate sent for this pin */
  locationCoordinate?: string;
  apiStatus?: string | null;
  apiError?: string | null;
};

export type GridLocalStats = {
  avgRank: number | null;
  tarp: number | null;
  distribution: { high: number; med: number; low: number; out: number };
};

export type GridLocalScan = {
  v: 1;
  siteId: string;
  businessName: string;
  keyword: string;
  center: { lat: number; lng: number };
  radiusKm: number;
  pins: GridLocalPin[];
  scannedAt: string;
  stats: GridLocalStats;
  targetPlaceId?: string | null;
  targetCid?: string | null;
};

const STORAGE_PREFIX = "flowbie.grid-local.v1.";
export const GRID_LOCAL_SIZE = 7;
export const GRID_LOCAL_PIN_COUNT = GRID_LOCAL_SIZE * GRID_LOCAL_SIZE;
export const GRID_LOCAL_SERP_DEPTH = 100;
const SERP_DEPTH = GRID_LOCAL_SERP_DEPTH;

export const GRID_LOCAL_MAPS_ZOOM = "17z";

function mapsLocationCoordinate(lat: number, lng: number): string {
  return `${lat.toFixed(7)},${lng.toFixed(7)},${GRID_LOCAL_MAPS_ZOOM}`;
}

function storageKey(siteId: string): string {
  return `${STORAGE_PREFIX}${siteId}`;
}

export function readGridLocalScan(siteId: string): GridLocalScan | null {
  if (!siteId) return null;
  try {
    const raw = localStorage.getItem(storageKey(siteId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GridLocalScan;
    if (parsed?.v !== 1 || !Array.isArray(parsed.pins)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeGridLocalScan(scan: GridLocalScan): void {
  if (!scan.siteId) return;
  try {
    localStorage.setItem(storageKey(scan.siteId), JSON.stringify(scan));
  } catch {
    /* quota */
  }
}

export function clearGridLocalScan(siteId: string): void {
  if (!siteId) return;
  try {
    localStorage.removeItem(storageKey(siteId));
  } catch {
    /* ignore */
  }
}

export function buildGridCoords(
  center: { lat: number; lng: number },
  radiusKm: number,
  size = GRID_LOCAL_SIZE,
): GridLocalPin[] {
  const half = radiusKm;
  const stepKm = size > 1 ? (2 * half) / (size - 1) : 0;
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos((center.lat * Math.PI) / 180);
  const mid = Math.floor(size / 2);
  const pins: GridLocalPin[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const northKm = half - row * stepKm;
      const eastKm = -half + col * stepKm;
      pins.push({
        lat: center.lat + northKm / kmPerDegLat,
        lng: center.lng + eastKm / kmPerDegLng,
        rank: null,
        isCenter: row === mid && col === mid,
      });
    }
  }
  return pins;
}

function normName(s: string): string {
  return s.trim().toLowerCase();
}

function namesMatch(title: string, businessName: string): boolean {
  const a = normName(title);
  const b = normName(businessName);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const headA = a.split(":")[0]?.trim() ?? a;
  const headB = b.split(":")[0]?.trim() ?? b;
  if (headA && headB && (headA.includes(headB) || headB.includes(headA))) return true;
  return false;
}

function businessNameAliases(
  site: WordPressSite,
  gmbTitle: string,
  gbpFileName?: string,
): string[] {
  const out = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t) out.add(t);
    const head = t.split(":")[0]?.trim();
    if (head && head.length >= 3) out.add(head);
  };
  if (gbpFileName) add(gbpFileName);
  add(gmbTitle);
  add(site.napInfo?.name ?? "");
  add(wordpressSiteDisplayName(site));
  for (const part of site.name.split("|")) add(part);
  for (const part of (site.napInfo?.name ?? "").split("|")) add(part);
  return [...out];
}

const MAPS_LISTING_SKIP_TYPES = new Set(["maps_pagination", "maps_refinement"]);

function cidStringFromItem(o: Record<string, unknown>): string {
  if (typeof o.cid === "string" && /^\d+$/.test(o.cid.trim())) {
    return o.cid.trim();
  }
  if (typeof o.cid === "number" && Number.isFinite(o.cid)) {
    const s = String(o.cid);
    if (s.includes("e") || s.includes("E")) return "";
    return s.replace(/\.0+$/, "").split(".")[0] ?? "";
  }
  return "";
}

function serpRowFromItem(o: Record<string, unknown>): GridLocalSerpRow | null {
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const rank =
    typeof o.rank_group === "number"
      ? o.rank_group
      : typeof o.rank_absolute === "number"
        ? o.rank_absolute
        : null;
  if (!title || rank == null) return null;
  const rawPid = typeof o.place_id === "string" ? o.place_id.trim() : "";
  const placeId = rawPid || null;
  const cid = cidStringFromItem(o) || null;
  return { rank, title, placeId, cid };
}

function extractMapsSerpRows(items: unknown[]): GridLocalSerpRow[] {
  const out: GridLocalSerpRow[] = [];
  const walk = (arr: unknown[]) => {
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      if (Array.isArray(o.items)) walk(o.items);
      const type = typeof o.type === "string" ? o.type : "";
      if (type && MAPS_LISTING_SKIP_TYPES.has(type)) continue;
      const row = serpRowFromItem(o);
      if (row) out.push(row);
    }
  };
  walk(items);
  return out;
}

export function parseMapsSerpItems(json: unknown): GridLocalSerpRow[] {
  const root = json as { tasks?: Array<{ result?: Array<{ items?: unknown[] }> }> };
  const items = root.tasks?.[0]?.result?.[0]?.items;
  if (!Array.isArray(items)) return [];
  return extractMapsSerpRows(items);
}

export function normalizeGridLocalTargetIds(ids: {
  placeId?: string | null;
  cid?: string | null;
}): { placeId: string | null; cid: string | null } {
  const pid = ids.placeId?.trim() || null;
  const c = ids.cid?.trim() || null;
  if (pid && /^\d+$/.test(pid) && !c) {
    return { placeId: null, cid: pid };
  }
  return { placeId: pid, cid: c };
}

function itemMatchesTargetIds(
  o: Record<string, unknown>,
  target: { placeId: string | null; cid: string | null },
): boolean {
  const itemPid = typeof o.place_id === "string" ? o.place_id.trim() : "";
  const itemCid = cidStringFromItem(o);
  if (target.placeId && itemPid && itemPid === target.placeId) return true;
  if (target.cid && itemCid && itemCid === target.cid) return true;
  if (target.cid && itemPid && /^\d+$/.test(itemPid) && itemPid === target.cid) return true;
  return false;
}

function matchRankInRawItems(items: unknown[], target: { placeId: string | null; cid: string | null }): number | null {
  const walk = (arr: unknown[]): number | null => {
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const rankGroup = typeof o.rank_group === "number" ? o.rank_group : null;
      if (rankGroup != null && itemMatchesTargetIds(o, target)) return rankGroup;
      if (Array.isArray(o.items)) {
        const nested = walk(o.items);
        if (nested != null) return nested;
      }
    }
    return null;
  };
  return walk(items);
}

function matchRankInSerpRows(
  rows: GridLocalSerpRow[],
  nameAliases: string[],
  target: { placeId: string | null; cid: string | null },
  json?: unknown,
): number | null {
  const rootItems = json as {
    tasks?: Array<{ result?: Array<{ items?: unknown[] }> }> };
  const rawItems = rootItems.tasks?.[0]?.result?.[0]?.items;
  if (Array.isArray(rawItems)) {
    const byId = matchRankInRawItems(rawItems, target);
    if (byId != null) return byId;
  }
  for (const row of rows) {
    if (target.placeId && row.placeId && row.placeId === target.placeId) return row.rank;
    if (target.cid && row.cid && row.cid === target.cid) return row.rank;
  }
  if (target.placeId || target.cid) return null;
  for (const row of rows) {
    if (nameAliases.some((alias) => namesMatch(row.title, alias))) return row.rank;
  }
  return null;
}

export function findBusinessRankInMapsSerp(
  json: unknown,
  site: WordPressSite,
  businessName: string,
  ids?: { placeId?: string | null; cid?: string | null },
  gbpFileName?: string,
): { rank: number | null; serp: GridLocalSerpRow[] } {
  const serp = parseMapsSerpItems(json);
  const rank = matchRankInSerpRows(
    serp,
    businessNameAliases(site, businessName, gbpFileName),
    normalizeGridLocalTargetIds({ placeId: ids?.placeId, cid: ids?.cid }),
    json,
  );
  return { rank, serp };
}

export function computeGridLocalStats(pins: GridLocalPin[]): GridLocalStats {
  const total = pins.length || 1;
  let high = 0;
  let med = 0;
  let low = 0;
  let out = 0;
  const ranks: number[] = [];
  for (const pin of pins) {
    const r = pin.rank;
    if (r == null || r > SERP_DEPTH) {
      out++;
    } else {
      ranks.push(r);
      if (r <= 3) high++;
      else if (r <= 10) med++;
      else low++;
    }
  }
  const avgRank = ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null;
  return {
    avgRank,
    tarp: avgRank,
    distribution: {
      high: Math.round((high / total) * 100),
      med: Math.round((med / total) * 100),
      low: Math.round((low / total) * 100),
      out: Math.round((out / total) * 100),
    },
  };
}

export function rankPinColor(rank: number | null): string {
  if (rank == null) return "#71717a";
  if (rank <= 3) return "#22c55e";
  if (rank <= 6) return "#eab308";
  if (rank <= 10) return "#f97316";
  if (rank <= SERP_DEPTH) return "#ef4444";
  return "#71717a";
}

function dfsLocationNameFromGbp(gbp: {
  city: string;
  region: string;
  country: string;
}): string | undefined {
  const city = gbp.city?.trim();
  const region = gbp.region?.trim();
  const country = gbp.country?.trim();
  if (!city || !country) return undefined;
  return region ? `${city},${region},${country}` : `${city},${country}`;
}

async function resolveGbpCenter(
  site: WordPressSite,
  onStatus?: (message: string) => void,
): Promise<{
  center: { lat: number; lng: number };
  businessName: string;
  placeId: string | null;
  cid: string | null;
  gbpFileName: string;
}> {
  onStatus?.("Reading GBP address from Master Rules…");
  const gbp = gbpGridContextFromMasterInstructions(site.id);
  if (!gbp) {
    throw new Error(gbpGridPlaceFailureReason(site.id));
  }

  const businessName =
    gbp.businessName?.trim() ||
    site.napInfo?.name?.trim() ||
    wordpressSiteDisplayName(site);

  if (hasGbpMasterRulesAddressForGeocode(gbp)) {
    const masterAddress = formatGbpMasterRulesAddressForGeocode(gbp);
    onStatus?.(`Geocoding Master Rules address: ${masterAddress}`);
    let center: { lat: number; lng: number };
    try {
      center = await geocodeStreetAddressViaOpenRouter(masterAddress, site.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Could not geocode Master Rules address (${masterAddress}): ${msg}`);
    }

    let ids = normalizeGridLocalTargetIds({ placeId: gbp.placeId, cid: gbp.cid });
    if (!ids.placeId && !ids.cid) {
      onStatus?.("Resolving Place ID from Master Rules address…");
      const gmbJson = await fetchLocalStrategyGmbDfsRaw({
        keyword: masterAddress,
        locationName: dfsLocationNameFromGbp(gbp),
        websiteUrl: site.siteUrl,
      });
      const resolved = extractGmbDfsPlaceIdentifiers(gmbJson);
      ids = normalizeGridLocalTargetIds(resolved);
    }

    onStatus?.(
      `Grid center from Master Rules address (${center.lat.toFixed(4)}, ${center.lng.toFixed(4)})`,
    );
    return {
      center,
      businessName,
      placeId: ids.placeId,
      cid: ids.cid,
      gbpFileName: gbp.businessName,
    };
  }

  throw new Error(gbpGridPlaceFailureReason(site.id));
}

export type GridLocalScanCallbacks = {
  onProgress?: (completed: number, total: number) => void;
  onPinComplete?: (pin: GridLocalPin, scan: GridLocalScan) => void;
  onGridReady?: (scan: GridLocalScan) => void;
  onStatus?: (message: string) => void;
  signal?: AbortSignal;
};

export async function runGridLocalScan(
  args: {
    site: WordPressSite;
    keyword: string;
    radiusKm: number;
  } & GridLocalScanCallbacks,
): Promise<GridLocalScan> {
  const kw = args.keyword.trim();
  if (!kw) throw new Error("Enter a keyword to scan.");
  const siteId = args.site.id;
  if (!siteId) throw new Error("Connect a WordPress property first.");

  const gmb = await resolveGbpCenter(args.site, args.onStatus);
  const pins = buildGridCoords(gmb.center, args.radiusKm);
  const targetIds = normalizeGridLocalTargetIds({ placeId: gmb.placeId, cid: gmb.cid });
  const ids = targetIds;
  let completed = 0;

  const scan: GridLocalScan = {
    v: 1,
    siteId,
    businessName: gmb.businessName,
    keyword: kw,
    center: gmb.center,
    radiusKm: args.radiusKm,
    pins: pins.map((p) => ({ ...p })),
    scannedAt: new Date().toISOString(),
    stats: computeGridLocalStats(pins),
    targetPlaceId: targetIds.placeId,
    targetCid: targetIds.cid,
  };

  args.onGridReady?.({ ...scan, pins: [...scan.pins] });

  args.onStatus?.(`Google Local Finder SERP for ${scan.pins.length} pins (server parallel)…`);

  let batchError: string | null = null;
  let batchResults: Awaited<ReturnType<typeof fetchGridLocalMapsSerpBatch>> | null = null;

  try {
    batchResults = await fetchGridLocalMapsSerpBatch({
      keyword: kw,
      pins: scan.pins.map((p) => ({ lat: p.lat, lng: p.lng })),
      language_code: "en",
      depth: SERP_DEPTH,
      signal: args.signal,
    });
  } catch (err) {
    batchError = err instanceof Error ? err.message : String(err);
  }

  for (let index = 0; index < scan.pins.length; index++) {
    if (args.signal?.aborted) break;
    const pin = scan.pins[index];
    const coord = mapsLocationCoordinate(pin.lat, pin.lng);
    let rank: number | null = null;
    let serp: GridLocalSerpRow[] = [];
    let apiStatus: string | null = null;
    let apiError: string | null = batchError;

    const pinResult = batchResults?.pins[index];
    if (pinResult) {
      apiStatus = pinResult.apiStatus;
      apiError = pinResult.apiError ?? batchError;
      if (pinResult.taskJson && !pinResult.apiError) {
        const parsed = findBusinessRankInMapsSerp(
          pinResult.taskJson,
          args.site,
          gmb.businessName,
          ids,
          gmb.gbpFileName,
        );
        rank = parsed.rank;
        serp = parsed.serp;
      }
    }

    scan.pins[index] = {
      ...pin,
      rank,
      serp,
      locationCoordinate: pinResult?.locationCoordinate ?? coord,
      apiStatus,
      apiError,
      scannedAt: new Date().toISOString(),
    };
    completed++;
    scan.stats = computeGridLocalStats(scan.pins);
    scan.scannedAt = new Date().toISOString();
    writeGridLocalScan(scan);
    args.onProgress?.(completed, scan.pins.length);
    args.onPinComplete?.(scan.pins[index], { ...scan, pins: [...scan.pins] });
  }

  writeGridLocalScan(scan);
  return scan;
}

function csvCell(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** One row per Maps SERP business per pin. */
export function gridLocalResultsToCsv(scan: GridLocalScan): string {
  const header =
    "keyword,pin_lat,pin_lng,location_coordinate,target_rank,target_place_id,target_cid,serp_rank,business_name,place_id,cid,is_target,api_error";
  const lines = [header];
  const targetPid = scan.targetPlaceId ?? "";
  const targetCid = scan.targetCid ?? "";
  for (const pin of scan.pins) {
    const coord = pin.locationCoordinate ?? mapsLocationCoordinate(pin.lat, pin.lng);
    const err = pin.apiError ?? "";
    const rows = pin.serp ?? [];
    if (rows.length === 0) {
      lines.push(
        [
          csvCell(scan.keyword),
          csvCell(pin.lat.toFixed(7)),
          csvCell(pin.lng.toFixed(7)),
          csvCell(coord),
          csvCell(pin.rank ?? ""),
          csvCell(targetPid),
          csvCell(targetCid),
          "",
          "",
          "",
          "",
          "",
          csvCell(err),
        ].join(","),
      );
      continue;
    }
    for (const row of rows) {
      const isTarget =
        (pin.rank != null && row.rank === pin.rank) ||
        (targetCid && row.cid === targetCid) ||
        (targetPid && row.placeId === targetPid)
          ? "yes"
          : "no";
      lines.push(
        [
          csvCell(scan.keyword),
          csvCell(pin.lat.toFixed(7)),
          csvCell(pin.lng.toFixed(7)),
          csvCell(coord),
          csvCell(pin.rank ?? ""),
          csvCell(targetPid),
          csvCell(targetCid),
          csvCell(row.rank),
          csvCell(row.title),
          csvCell(row.placeId ?? ""),
          csvCell(row.cid ?? ""),
          csvCell(isTarget),
          csvCell(err),
        ].join(","),
      );
    }
  }
  return lines.join("\n");
}

export function downloadGridLocalResultsCsv(scan: GridLocalScan): void {
  const csv = gridLocalResultsToCsv(scan);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = scan.keyword.replace(/[^a-z0-9]+/gi, "-").slice(0, 40);
  a.href = url;
  a.download = `grid-local-${slug}-${scan.scannedAt.slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Plain-text audit report: every pin query + every listing returned. */
export function gridLocalScanToTextReport(scan: GridLocalScan): string {
  const lines: string[] = [];
  lines.push("Grid Local Search Report");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Scanned at: ${scan.scannedAt}`);
  lines.push(`Business: ${scan.businessName}`);
  lines.push(`Keyword: ${scan.keyword}`);
  lines.push(`Grid center: ${scan.center.lat.toFixed(7)}, ${scan.center.lng.toFixed(7)}`);
  lines.push(`Radius: ${scan.radiusKm} km (${GRID_LOCAL_SIZE}x${GRID_LOCAL_SIZE} = ${scan.pins.length} pins)`);
  lines.push(`SERP depth: ${SERP_DEPTH} (top ${SERP_DEPTH} businesses per pin)`);
  lines.push(
    `Target Place ID: ${scan.targetPlaceId ?? "n/a"} | Target CID: ${scan.targetCid ?? "n/a"}`,
  );
  lines.push(
    `API: DataForSEO google/local_finder/live/advanced (${scan.pins.length} calls, zoom ${GRID_LOCAL_MAPS_ZOOM}, depth ${SERP_DEPTH})`,
  );
  lines.push("");

  let pinsWithListings = 0;
  let pinsWithErrors = 0;
  let rankedPins = 0;

  scan.pins.forEach((pin, i) => {
    const label = pin.isCenter ? "CENTER" : `pin ${i + 1}`;
    lines.push(`--- ${label} ---`);
    lines.push(`Lat/Lng: ${pin.lat.toFixed(7)}, ${pin.lng.toFixed(7)}`);
    lines.push(`location_coordinate: ${pin.locationCoordinate ?? mapsLocationCoordinate(pin.lat, pin.lng)}`);
    lines.push(`Target rank: ${pin.rank != null ? String(pin.rank) : "OUT"}`);
    if (pin.apiError) {
      pinsWithErrors++;
      lines.push(`API error: ${pin.apiError}`);
    } else if (pin.apiStatus) {
      lines.push(`API status: ${pin.apiStatus}`);
    }
    const rows = pin.serp ?? [];
    if (rows.length === 0) {
      lines.push("Listings: (none returned)");
    } else {
      pinsWithListings++;
      lines.push(`Listings (${rows.length}):`);
      for (const row of rows) {
        lines.push(`  #${row.rank} ${row.title}`);
      }
    }
    if (pin.rank != null) rankedPins++;
    lines.push("");
  });

  lines.push("--- Summary ---");
  lines.push(`Ranked pins: ${rankedPins}/${scan.pins.length}`);
  lines.push(`Pins with listings: ${pinsWithListings}/${scan.pins.length}`);
  lines.push(`Pins with API errors: ${pinsWithErrors}/${scan.pins.length}`);
  lines.push(
    `Distribution: High ${scan.stats.distribution.high}% | Med ${scan.stats.distribution.med}% | Low ${scan.stats.distribution.low}% | Out ${scan.stats.distribution.out}%`,
  );
  lines.push(`Avg rank: ${scan.stats.avgRank != null ? scan.stats.avgRank.toFixed(2) : "n/a"}`);
  return lines.join("\n");
}

export function downloadGridLocalSearchReport(scan: GridLocalScan): void {
  const text = gridLocalScanToTextReport(scan);
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = scan.keyword.replace(/[^a-z0-9]+/gi, "-").slice(0, 40);
  a.href = url;
  a.download = `grid-local-report-${slug}-${scan.scannedAt.slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Report lines for the Details drawer (one line per pin + summary). */
export function gridLocalScanReportLines(scan: GridLocalScan): string[] {
  const lines: string[] = [
    `Report: ${scan.keyword} | ${scan.businessName}`,
    `Center ${scan.center.lat.toFixed(5)}, ${scan.center.lng.toFixed(5)} | ${scan.radiusKm} km | ${scan.pins.length} pins (local_finder ${GRID_LOCAL_MAPS_ZOOM})`,
    `Track: place_id=${scan.targetPlaceId ?? "n/a"} cid=${scan.targetCid ?? "n/a"}`,
  ];
  scan.pins.forEach((pin, i) => {
    const label = pin.isCenter ? "center" : `#${i + 1}`;
    const coord = pin.locationCoordinate ?? mapsLocationCoordinate(pin.lat, pin.lng);
    if (pin.apiError) {
      lines.push(`${label} ${coord} | ERROR: ${pin.apiError}`);
      return;
    }
    const count = pin.serp?.length ?? 0;
    const top =
      pin.serp?.slice(0, 5).map((r) => `#${r.rank} ${r.title}`).join(" | ") ?? "";
    lines.push(
      `${label} ${coord} | rank ${pin.rank ?? "OUT"} | ${count} listings${top ? ` | ${top}` : ""}`,
    );
  });
  const ranked = scan.pins.filter((p) => p.rank != null).length;
  const errors = scan.pins.filter((p) => p.apiError).length;
  lines.push(
    `Summary: ${ranked}/${scan.pins.length} ranked, ${errors} API errors, Out ${scan.stats.distribution.out}%`,
  );
  return lines;
}
