/** Merge generated file lists by name (later entries win). Avoids duplicate peer CSVs. */
export function mergeGeneratedFilesByName(
  existing: Array<{ name: string; content: string; mimeType: string }>,
  incoming: Array<{ name: string; content: string; mimeType: string }>,
): Array<{ name: string; content: string; mimeType: string }> {
  const byName = new Map<string, { name: string; content: string; mimeType: string }>();
  for (const f of existing) {
    if (f?.name) byName.set(f.name, f);
  }
  for (const f of incoming) {
    if (f?.name) byName.set(f.name, f);
  }
  return [...byName.values()];
}

export type PeerLocalSiteLink = { name: string; siteUrl: string };

export type GeneratedDetailFile = { name: string; content: string; mimeType: string };

export const PEER_SITES_PLAN_FILE_NAME = "peer-sites-to-scrape.md";

export const COMBINED_PEER_LOCAL_IMAGES_CSV_NAME = "peer-local-images.csv";

/** Filename slug shared by peer CSV builder and Details UI matching. */
export function peerLocalImagesCsvFileSlug(siteNameOrUrl: string): string {
  const raw = String(siteNameOrUrl ?? "").trim().toLowerCase();
  let out = "";
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i]!;
    const code = ch.charCodeAt(0);
    const isDigit = code >= 48 && code <= 57;
    const isLower = code >= 97 && code <= 122;
    if (isDigit || isLower) {
      out += ch;
      continue;
    }
    if (out.length > 0 && out[out.length - 1] !== "-") out += "-";
  }
  while (out.endsWith("-")) out = out.slice(0, -1);
  if (out.length > 48) out = out.slice(0, 48);
  return out || "peer";
}

/** `peer-local-images-{slug}.csv` for a peer site name or URL. */
export function peerLocalImagesCsvFileName(siteNameOrUrl: string): string {
  return `peer-local-images-${peerLocalImagesCsvFileSlug(siteNameOrUrl)}.csv`;
}

function isPeerLocalImagesCsvName(name: string): boolean {
  const n = String(name || "");
  return n.startsWith("peer-local-images-") && n.endsWith(".csv");
}

/**
 * Split Details files into plan + combined peer CSV + non-peer artifacts.
 * Peer CSVs / plan stay in storage; UI uses this so they are not listed twice.
 */
export function partitionPeerDetailFiles(params: {
  peers: PeerLocalSiteLink[];
  files: GeneratedDetailFile[];
}): {
  planFile: GeneratedDetailFile | null;
  combinedCsvFile: GeneratedDetailFile | null;
  summaryFile: GeneratedDetailFile | null;
  rows: Array<{ peer: PeerLocalSiteLink }>;
  otherFiles: GeneratedDetailFile[];
} {
  const byName = new Map<string, GeneratedDetailFile>();
  for (const f of params.files ?? []) {
    if (f?.name) byName.set(f.name, f);
  }

  const planFile = byName.get(PEER_SITES_PLAN_FILE_NAME) ?? null;
  const combinedCsvFile = byName.get(COMBINED_PEER_LOCAL_IMAGES_CSV_NAME) ?? null;
  const summaryFile = byName.get("local-image-summary.md") ?? null;
  const claimed = new Set<string>();
  if (planFile) claimed.add(PEER_SITES_PLAN_FILE_NAME);
  if (combinedCsvFile) claimed.add(COMBINED_PEER_LOCAL_IMAGES_CSV_NAME);
  if (summaryFile) claimed.add("local-image-summary.md");

  const rows = (params.peers ?? []).map((peer) => ({ peer }));

  // Claim legacy per-site peer-local-images-*.csv so they stay out of Generated files.
  for (const name of byName.keys()) {
    if (isPeerLocalImagesCsvName(name)) claimed.add(name);
  }

  const otherFiles: GeneratedDetailFile[] = [];
  for (const f of params.files ?? []) {
    if (!f?.name || claimed.has(f.name)) continue;
    otherFiles.push(f);
  }

  return { planFile, combinedCsvFile, summaryFile, rows, otherFiles };
}

/** Short Checklist status (full roster lives in downloadable peer-sites-to-scrape.md). */
export function formatPeerSitesChecklistStatus(params: {
  entity: string;
  peerCount: number;
}): string {
  const entity = (params.entity || "").trim() || "place";
  const n = Math.max(0, Number(params.peerCount) || 0);
  if (n <= 0) {
    return `City peers: 0 for ${entity}. No matching peer sitemaps.`;
  }
  return `City peers: ${n} for ${entity}. Download the sitemap plan once from Details (batch).`;
}

/** Markdown plan of peer sites to scrape (downloadable peer-sites-to-scrape.md). */
export function formatPeerSitesPlanMarkdown(params: {
  entity: string;
  peers: PeerLocalSiteLink[];
}): string {
  const lines = [
    `# Peer Local Image sites`,
    "",
    `City from post entity: ${params.entity}`,
    "",
    `Peers with sitemap URLs matching that city (${params.peers.length}):`,
    "",
  ];
  if (!params.peers.length) {
    lines.push("No peer sitemaps matched this city.");
    return lines.join("\n");
  }
  for (let i = 0; i < params.peers.length; i += 1) {
    const p = params.peers[i]!;
    const name = (p.name || "").trim() || p.siteUrl;
    const href = (p.siteUrl || "").trim();
    if (href) {
      lines.push(`${i + 1}. [${name}](${href})`);
    } else {
      lines.push(`${i + 1}. ${name}`);
    }
  }
  return lines.join("\n");
}

export function buildPeerSitesPlanFile(params: {
  entity: string;
  peers: PeerLocalSiteLink[];
}): { name: string; content: string; mimeType: string } {
  return {
    name: PEER_SITES_PLAN_FILE_NAME,
    content: formatPeerSitesPlanMarkdown(params),
    mimeType: "text/markdown;charset=utf-8",
  };
}

/**
 * Details drawer: show harness + Generated files even when Local Image is
 * classified as a parallel harness row (which otherwise hides showOptimizationSequence).
 */
export function shouldShowDetailsFlatGeneratedFiles(params: {
  isDetailsOnly: boolean;
  showOptimizationSequence: boolean;
  harnessSectionCount: number;
  generatedFileCount: number;
  peerSiteCount?: number;
  isActive: boolean;
  isWarmingUp: boolean;
  isDetailsActivePost: boolean;
  isCompleted: boolean;
  isSkipped: boolean;
  isError: boolean;
}): boolean {
  if (params.showOptimizationSequence) return true;
  if (!params.isDetailsOnly) return false;
  const hasContent =
    params.harnessSectionCount > 0 ||
    params.generatedFileCount > 0 ||
    (params.peerSiteCount ?? 0) > 0;
  if (!hasContent) return false;
  return (
    params.isActive ||
    params.isWarmingUp ||
    params.isDetailsActivePost ||
    params.isCompleted ||
    params.isSkipped ||
    params.isError
  );
}
