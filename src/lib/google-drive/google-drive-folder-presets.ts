const STORAGE_KEY = "neo-pulse_google_drive_folder_presets_v1";

export type GoogleDriveFolderPreset = {
  id: string;
  label: string;
  folderId: string;
  builtin?: boolean;
};

export const BUILTIN_ADVANCED_BLINDS_PRESET: GoogleDriveFolderPreset = {
  id: "advanced_blinds",
  label: "Advance Blinds",
  folderId: "1ykfW8uMfv0jFP1YOUbNYdvuTBEcOB9n7",
  builtin: true,
};

const BUILTINS: GoogleDriveFolderPreset[] = [BUILTIN_ADVANCED_BLINDS_PRESET];

export function parseGoogleDriveFolderId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const urlMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (urlMatch?.[1]) return urlMatch[1];
  const idMatch = trimmed.match(/^[a-zA-Z0-9_-]{10,}$/);
  return idMatch ? trimmed : "";
}

export function formatGoogleDriveFolderUrl(folderId: string): string {
  const id = parseGoogleDriveFolderId(folderId);
  if (!id) return "";
  return `https://drive.google.com/drive/folders/${id}`;
}

export function findGoogleDriveFolderPresetByFolderId(
  folderId: string,
): GoogleDriveFolderPreset | null {
  const parsed = parseGoogleDriveFolderId(folderId);
  if (!parsed) return null;
  return listGoogleDriveFolderPresets().find((preset) => preset.folderId === parsed) ?? null;
}

export function loadUserGoogleDriveFolderPresets(): GoogleDriveFolderPreset[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as Record<string, unknown>;
        const id = String(row.id ?? "").trim();
        const label = String(row.label ?? "").trim();
        const folderId = parseGoogleDriveFolderId(String(row.folderId ?? ""));
        if (!id || !label || !folderId) return null;
        return { id, label, folderId } satisfies GoogleDriveFolderPreset;
      })
      .filter((item): item is GoogleDriveFolderPreset => item !== null);
  } catch {
    return [];
  }
}

export function saveUserGoogleDriveFolderPresets(presets: GoogleDriveFolderPreset[]): void {
  if (typeof localStorage === "undefined") return;
  const userOnly = presets.filter((preset) => !preset.builtin);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userOnly));
}

export function listGoogleDriveFolderPresets(): GoogleDriveFolderPreset[] {
  return [...BUILTINS, ...loadUserGoogleDriveFolderPresets()];
}

export function resolveGoogleDriveFolderPreset(
  key: string | undefined,
  customFolderId?: string,
): { folderId: string; label: string; presetKey: string } | null {
  const presetKey = String(key ?? "").trim();
  if (presetKey === "custom") {
    const folderId = parseGoogleDriveFolderId(String(customFolderId ?? ""));
    if (!folderId) return null;
    return { folderId, label: "Custom folder", presetKey: "custom" };
  }
  if (presetKey) {
    const preset = listGoogleDriveFolderPresets().find((item) => item.id === presetKey);
    if (preset) {
      return { folderId: preset.folderId, label: preset.label, presetKey: preset.id };
    }
  }
  const folderId = parseGoogleDriveFolderId(String(customFolderId ?? ""));
  if (folderId) {
    return { folderId, label: "Custom folder", presetKey: presetKey || "custom" };
  }
  return null;
}

export function suggestPresetForSiteName(
  siteName: string,
  siteUrl?: string,
): GoogleDriveFolderPreset | null {
  const normalized = siteName.trim().toLowerCase();
  const url = siteUrl?.trim().toLowerCase() ?? "";
  if (url.includes("advanceblindsanddrapery") || url.includes("advancedblinds")) {
    return BUILTIN_ADVANCED_BLINDS_PRESET;
  }
  if (!normalized) return null;
  if (
    normalized.includes("advanced blinds") ||
    normalized.includes("advance blinds") ||
    normalized.includes("advance blinds & drapery") ||
    normalized.includes("advance blinds and drapery")
  ) {
    return BUILTIN_ADVANCED_BLINDS_PRESET;
  }
  return null;
}
