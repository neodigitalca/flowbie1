import { tasksApi } from "@/lib/tasks-api";
import {
  defaultGoogleDriveTeamSettings,
  normalizeGoogleDriveTeamSettings,
  type GoogleDriveTeamSettings,
} from "@/lib/google-drive/google-drive-folder-hierarchy";

const TEAM_SETTINGS_STORAGE_KEY = "neo-pulse_google_drive_team_settings_v1";

export type LoadedGoogleDriveTeamSettings = {
  settings: GoogleDriveTeamSettings;
  source: "api" | "cache" | "defaults";
  loadError?: string;
};

function formatDriveApiError(err: unknown): string {
  return err instanceof Error ? err.message.trim() : "Google Drive request failed.";
}

export function readCachedGoogleDriveTeamSettings(): GoogleDriveTeamSettings | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(TEAM_SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    return normalizeGoogleDriveTeamSettings(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeCachedGoogleDriveTeamSettings(settings: GoogleDriveTeamSettings): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(TEAM_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore quota / private mode
  }
}

export type DriveFolderMatch = {
  folderId: string;
  name: string;
  webViewLink?: string;
};

type ApiEnvelope<T> = T & {
  success?: boolean;
  error?: string;
};

async function driveApiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<ApiEnvelope<T>> {
  const response = await tasksApi(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await response.json().catch(() => ({}))) as ApiEnvelope<T> & { path?: string };
  if (!response.ok) {
    const detail = data.error ?? response.statusText ?? "Google Drive request failed.";
    const suffix = typeof data.path === "string" && data.path.trim() ? ` (${data.path})` : "";
    throw new Error(`${detail}${suffix}`);
  }
  return data;
}

export async function fetchGoogleDriveTeamSettings(): Promise<GoogleDriveTeamSettings> {
  const data = await driveApiRequest<{ settings?: unknown }>("/google-mcp/team-settings", {
    method: "GET",
  });
  const settings = normalizeGoogleDriveTeamSettings(data.settings);
  writeCachedGoogleDriveTeamSettings(settings);
  return settings;
}

export async function loadGoogleDriveTeamSettings(): Promise<LoadedGoogleDriveTeamSettings> {
  try {
    const settings = await fetchGoogleDriveTeamSettings();
    return { settings, source: "api" };
  } catch (err) {
    const cached = readCachedGoogleDriveTeamSettings();
    if (cached) {
      return { settings: cached, source: "cache", loadError: formatDriveApiError(err) };
    }
    return {
      settings: defaultGoogleDriveTeamSettings(),
      source: "defaults",
      loadError: formatDriveApiError(err),
    };
  }
}

export async function saveGoogleDriveTeamSettings(
  settings: GoogleDriveTeamSettings,
): Promise<GoogleDriveTeamSettings> {
  const data = await driveApiRequest<{ settings?: unknown }>("/google-mcp/team-settings", {
    method: "POST",
    body: JSON.stringify(settings),
  });
  const saved = normalizeGoogleDriveTeamSettings(data.settings ?? settings);
  writeCachedGoogleDriveTeamSettings(saved);
  return saved;
}

export async function findDriveFolder(args: {
  parentFolderId: string;
  name: string;
  fuzzy?: boolean;
}): Promise<DriveFolderMatch[]> {
  const data = await driveApiRequest<{ matches?: DriveFolderMatch[] }>("/google-mcp/find-folder", {
    method: "POST",
    body: JSON.stringify(args),
  });
  return Array.isArray(data.matches) ? data.matches : [];
}

export async function listDriveFolderChildren(folderId: string): Promise<DriveFolderMatch[]> {
  const params = new URLSearchParams({ folderId });
  const data = await driveApiRequest<{ children?: DriveFolderMatch[] }>(
    `/google-mcp/list-folder-children?${params.toString()}`,
    { method: "GET" },
  );
  return Array.isArray(data.children) ? data.children : [];
}

export type ResolveDeliveryFolderInput = {
  siteName: string;
  siteUrl?: string;
  googleDriveFolderSource?: string;
  googleDriveFolderPath?: string;
  googleDriveFolderId?: string;
  googleDriveFolderLabel?: string;
  executionKind?: string;
  openRouterModel?: string;
};

export type ResolveDeliveryFolderResult = {
  folderId: string;
  label: string;
  webViewLink?: string;
  created?: string[];
  clientFolderId?: string;
  clientFolderName?: string;
};

export async function resolveDeliveryFolder(
  input: ResolveDeliveryFolderInput,
): Promise<ResolveDeliveryFolderResult> {
  const data = await driveApiRequest<{
    folderId?: string;
    label?: string;
    webViewLink?: string;
    created?: string[];
    clientFolderId?: string;
    clientFolderName?: string;
  }>("/google-mcp/resolve-folder-path", {
    method: "POST",
    body: JSON.stringify({
      ...input,
      deliveryResolve: true,
    }),
  });
  const folderId = String(data.folderId ?? "").trim();
  if (!folderId) {
    throw new Error("Google Drive delivery folder did not resolve.");
  }
  return {
    folderId,
    label: String(data.label ?? "").trim() || "Google Drive folder",
    webViewLink: data.webViewLink,
    created: Array.isArray(data.created) ? data.created : undefined,
    clientFolderId: data.clientFolderId,
    clientFolderName: data.clientFolderName,
  };
}

export async function resolveDriveFolderPath(args: {
  rootFolderId: string;
  segments: string[];
  createMissing?: boolean;
}): Promise<{ folderId: string; webViewLink?: string; created?: string[] }> {
  const data = await driveApiRequest<{
    folderId?: string;
    webViewLink?: string;
    created?: string[];
  }>("/google-mcp/resolve-folder-path", {
    method: "POST",
    body: JSON.stringify(args),
  });
  const folderId = String(data.folderId ?? "").trim();
  if (!folderId) {
    throw new Error("Google Drive folder path did not resolve.");
  }
  return {
    folderId,
    webViewLink: data.webViewLink,
    created: data.created,
  };
}

export async function moveDriveFile(args: {
  fileId: string;
  destinationFolderId: string;
}): Promise<{ fileId: string; name?: string; webViewLink?: string }> {
  const data = await driveApiRequest<{
    fileId?: string;
    name?: string;
    webViewLink?: string;
  }>("/google-mcp/move-file", {
    method: "POST",
    body: JSON.stringify(args),
  });
  return {
    fileId: String(data.fileId ?? args.fileId),
    name: data.name,
    webViewLink: data.webViewLink,
  };
}

export async function renameDriveFile(args: {
  fileId: string;
  newName: string;
}): Promise<{ fileId: string; name?: string; webViewLink?: string }> {
  const data = await driveApiRequest<{
    fileId?: string;
    name?: string;
    webViewLink?: string;
  }>("/google-mcp/rename-file", {
    method: "POST",
    body: JSON.stringify(args),
  });
  return {
    fileId: String(data.fileId ?? args.fileId),
    name: data.name,
    webViewLink: data.webViewLink,
  };
}

export function emptyGoogleDriveTeamSettings(): GoogleDriveTeamSettings {
  return defaultGoogleDriveTeamSettings();
}
