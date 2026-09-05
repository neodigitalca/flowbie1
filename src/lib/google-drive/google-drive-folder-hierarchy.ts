import type { WordPressSite } from "@/components/integrations/types";
import { EDMONTON_TZ } from "@/lib/edmonton-time";
import { wordpressSiteDisplayName } from "@/lib/wordpress-site-display-name";

export type GoogleDriveFolderPurposeKey = "reporting" | "audits" | "grids";

export type GoogleDriveFolderAlias = {
  key: GoogleDriveFolderPurposeKey;
  folderName: string;
  aliases: string[];
};

export type GoogleDriveTeamSettings = {
  teamRootFolderId: string;
  folderAliases: GoogleDriveFolderAlias[];
};

/** Shared Drive folder used when no custom team root is saved. */
export const DEFAULT_TEAM_SHARED_DRIVE_FOLDER_ID = "0AHAVAVW8TixdUk9PVA";

/** Workspace folder created under the shared drive for all client auto-find paths. */
export const NEO_PULSE_TEAM_WORKSPACE_FOLDER_NAME = "NEO Pulse";

export function googleDriveDeliveryFolderIsMonthLeaf(label: string): boolean {
  return /\/ (Reporting|Audits|Grids) \/ \d{4} \/ /i.test(label.trim());
}

const AUDIT_EXECUTION_KINDS = new Set([
  "chatgpt_website_audit",
  "chatgpt_audit",
  "dfs_llm_article_audit",
]);

const GRID_EXECUTION_KINDS = new Set(["local_dominator_export"]);

export function inferGoogleDriveDeliveryPath(
  executionKind?: string,
  fileName?: string,
): GoogleDriveFolderPurposeKey {
  const kind = String(executionKind ?? "").trim();
  if (AUDIT_EXECUTION_KINDS.has(kind)) return "audits";
  if (GRID_EXECUTION_KINDS.has(kind)) return "grids";
  if (kind === "gsc_reporting") return "reporting";

  const name = String(fileName ?? "").toLowerCase();
  if (name.includes("audit")) return "audits";
  if (name.includes("grid") || name.includes("local-dominator") || name.includes("local_dominator")) {
    return "grids";
  }
  return "reporting";
}

export function googleDrivePurposeFolderLabel(path: GoogleDriveFolderPurposeKey): string {
  if (path === "audits") return "Audits";
  if (path === "grids") return "Grids";
  return "Reporting";
}

export function isGoogleDriveFolderPurposeKey(value: string): value is GoogleDriveFolderPurposeKey {
  return value === "reporting" || value === "audits" || value === "grids";
}

/** Use the inferred folder unless the user picked a different one. */
export function resolveWorkflowDriveFolderPath(
  payload: {
    googleDriveFolderPath?: string;
    googleDriveFolderPathManual?: boolean;
  },
  executionKind?: string,
  fileName?: string,
): GoogleDriveFolderPurposeKey {
  const inferred = inferGoogleDriveDeliveryPath(executionKind, fileName);
  if (payload.googleDriveFolderPathManual !== true) return inferred;
  const saved = String(payload.googleDriveFolderPath ?? "").trim();
  return isGoogleDriveFolderPurposeKey(saved) ? saved : inferred;
}

export const DEFAULT_GOOGLE_DRIVE_FOLDER_ALIASES: GoogleDriveFolderAlias[] = [
  {
    key: "reporting",
    folderName: "Reporting",
    aliases: ["reporting", "reports", "gsc", "report"],
  },
  {
    key: "audits",
    folderName: "Audits",
    aliases: ["audits", "audit", "chatgpt-audit", "chatgpt audit"],
  },
  {
    key: "grids",
    folderName: "Grids",
    aliases: ["grids", "grid", "local-dominator", "local dominator"],
  },
];

export const GOOGLE_DRIVE_PATH_PRESETS: { value: GoogleDriveFolderPurposeKey; label: string }[] = [
  { value: "reporting", label: "Reporting" },
  { value: "audits", label: "Audits" },
  { value: "grids", label: "Grids" },
];

export function defaultGoogleDriveTeamSettings(): GoogleDriveTeamSettings {
  return {
    teamRootFolderId: DEFAULT_TEAM_SHARED_DRIVE_FOLDER_ID,
    folderAliases: DEFAULT_GOOGLE_DRIVE_FOLDER_ALIASES.map((item) => ({ ...item, aliases: [...item.aliases] })),
  };
}

export function resolveConfiguredTeamSharedDriveId(settings: GoogleDriveTeamSettings): string {
  const configured = String(settings.teamRootFolderId ?? "").trim();
  if (/^[a-zA-Z0-9_-]{10,}$/.test(configured)) return configured;
  return DEFAULT_TEAM_SHARED_DRIVE_FOLDER_ID;
}

export function normalizeGoogleDriveFolderAliases(
  raw: unknown,
): GoogleDriveFolderAlias[] {
  if (!Array.isArray(raw)) return defaultGoogleDriveTeamSettings().folderAliases;
  const defaults = defaultGoogleDriveTeamSettings().folderAliases;
  const byKey = new Map(defaults.map((item) => [item.key, item]));
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const key = String(row.key ?? "").trim() as GoogleDriveFolderPurposeKey;
    if (!byKey.has(key)) continue;
    const folderName = String(row.folderName ?? byKey.get(key)!.folderName).trim();
    const aliases = Array.isArray(row.aliases)
      ? row.aliases.map((alias) => String(alias).trim().toLowerCase()).filter(Boolean)
      : byKey.get(key)!.aliases;
    byKey.set(key, { key, folderName: folderName || byKey.get(key)!.folderName, aliases });
  }
  return [...byKey.values()];
}

export function normalizeGoogleDriveTeamSettings(raw: unknown): GoogleDriveTeamSettings {
  const defaults = defaultGoogleDriveTeamSettings();
  if (!raw || typeof raw !== "object") return defaults;
  const row = raw as Record<string, unknown>;
  const teamRootFolderId = String(row.teamRootFolderId ?? "").trim();
  return {
    teamRootFolderId:
      /^[a-zA-Z0-9_-]{10,}$/.test(teamRootFolderId)
        ? teamRootFolderId
        : DEFAULT_TEAM_SHARED_DRIVE_FOLDER_ID,
    folderAliases: normalizeGoogleDriveFolderAliases(row.folderAliases),
  };
}

/** Drive client folder label — matches Properties rows (wordpressSiteDisplayName). */
export function googleDriveClientFolderName(
  site: Pick<WordPressSite, "name" | "siteUrl" | "napInfo">,
): string {
  const display = wordpressSiteDisplayName(site as WordPressSite).trim();
  if (display) return display;
  return normalizeClientFolderName("", site.siteUrl);
}

export const propertiesClientFolderName = googleDriveClientFolderName;

export function normalizeClientFolderName(siteName: string, siteUrl?: string): string {
  const fromName = siteName.trim();
  if (fromName) return fromName;
  const url = String(siteUrl ?? "").trim();
  if (!url) return "";
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return host.replace(/^www\./i, "").split(".")[0] ?? "";
  } catch {
    return "";
  }
}

function normalizeDriveFolderName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Exact client folder name match. Case and extra spaces only. */
export function driveFolderNamesMatch(a: string, b: string): boolean {
  const left = normalizeDriveFolderName(a);
  const right = normalizeDriveFolderName(b);
  return Boolean(left) && left === right;
}

/** Client segment of `NEO Pulse / Client / Reporting / 2026 / September`. */
export function driveLabelClientSegment(label: string): string {
  const parts = label
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";
  if (driveFolderNamesMatch(parts[0] ?? "", NEO_PULSE_TEAM_WORKSPACE_FOLDER_NAME)) {
    return parts[1] ?? "";
  }
  return parts[0] ?? "";
}

export function driveFolderBelongsToClient(label: string, clientName: string): boolean {
  const want = clientName.trim();
  if (!want) return false;
  return driveFolderNamesMatch(driveLabelClientSegment(label), want);
}

export function pickExactDriveClientFolder<T extends { folderId: string; name: string }>(
  candidates: T[],
  clientName: string,
): T | null {
  const want = clientName.trim();
  if (!want) return null;
  return candidates.find((row) => driveFolderNamesMatch(row.name, want)) ?? null;
}

export function resolvePurposeFolderName(
  pathInput: string,
  aliases: GoogleDriveFolderAlias[] = DEFAULT_GOOGLE_DRIVE_FOLDER_ALIASES,
): string {
  const trimmed = pathInput.trim();
  if (!trimmed) return aliases.find((item) => item.key === "reporting")?.folderName ?? "Reporting";

  const segments = trimmed.split("/").map((part) => part.trim()).filter(Boolean);
  const leaf = segments[segments.length - 1]?.toLowerCase() ?? "";
  for (const alias of aliases) {
    if (alias.key === leaf || alias.folderName.toLowerCase() === leaf) {
      return alias.folderName;
    }
    if (alias.aliases.includes(leaf)) {
      return alias.folderName;
    }
  }
  return segments[segments.length - 1] ?? trimmed;
}

export function resolvePathSegments(
  pathInput: string,
  aliases: GoogleDriveFolderAlias[] = DEFAULT_GOOGLE_DRIVE_FOLDER_ALIASES,
): string[] {
  const trimmed = pathInput.trim();
  if (!trimmed) return [resolvePurposeFolderName("", aliases)];

  return trimmed
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => resolvePurposeFolderName(part, aliases));
}

const DRIVE_YEAR_SEGMENT_PATTERN = /^\d{4}$/;

function isDriveMonthSegment(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const parsed = Date.parse(`${trimmed} 1, 2000`);
  return Number.isFinite(parsed);
}

/** Last path segment when it is a month name (e.g. September). */
export function driveFolderMonthLeafName(label: string): string {
  const parts = label.split("/").map((part) => part.trim()).filter(Boolean);
  const leaf = (parts[parts.length - 1] ?? "").replace(/[).,].*$/, "").trim();
  return isDriveMonthSegment(leaf) ? leaf : "";
}

/** Month leaf for UI, or the full label when the path is not a month folder. */
export function driveFolderDisplayName(label: string): string {
  const month = driveFolderMonthLeafName(label);
  if (month) return month;
  return label.trim() || "Folder";
}

export function formatDriveYearSegment(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: EDMONTON_TZ, year: "numeric" }).format(date);
}

export function formatDriveMonthSegment(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: EDMONTON_TZ, month: "long" }).format(date);
}

export const DRIVE_MONTH_SEGMENTS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type DriveDeliveryCalendar = {
  year?: string;
  month?: string;
};

export function driveYearSelectOptions(date: Date = new Date()): string[] {
  const current = Number(formatDriveYearSegment(date));
  return [String(current - 1), String(current), String(current + 1)];
}

export function isDriveCalendarYear(value: string): boolean {
  return DRIVE_YEAR_SEGMENT_PATTERN.test(value.trim());
}

export function isDriveCalendarMonth(value: string): boolean {
  return isDriveMonthSegment(value);
}

/** @deprecated Prefer buildDeliverySubfolderSegments (client → year → month → purpose). */
export function appendDriveDateSegments(segments: string[], date: Date = new Date()): string[] {
  if (segments.length === 0) return segments;

  const yearSegment = formatDriveYearSegment(date);
  const monthSegment = formatDriveMonthSegment(date);
  const last = segments[segments.length - 1] ?? "";
  const secondLast = segments[segments.length - 2] ?? "";

  if (DRIVE_YEAR_SEGMENT_PATTERN.test(secondLast) && isDriveMonthSegment(last)) {
    return segments;
  }

  if (DRIVE_YEAR_SEGMENT_PATTERN.test(last)) {
    return [...segments, monthSegment];
  }

  return [...segments, yearSegment, monthSegment];
}

/** Delivery path under client root: purpose → year → month (matches provisioned NEO Pulse clients). */
export function buildDeliverySubfolderSegments(
  purposeSegments: string[],
  date: Date = new Date(),
  calendar?: DriveDeliveryCalendar,
): string[] {
  if (purposeSegments.length === 0) return [];
  const year = String(calendar?.year ?? "").trim();
  const month = String(calendar?.month ?? "").trim();
  if (DRIVE_YEAR_SEGMENT_PATTERN.test(year) && isDriveMonthSegment(month)) {
    return appendDriveDateSegments([...purposeSegments, year, month], date);
  }
  return appendDriveDateSegments(purposeSegments, date);
}
