export type PpcPlatformId = "google";

export const PPC_PLATFORM_STORAGE_KEY = "flowbie-ppc-platform";

export function readStoredPpcPlatform(): PpcPlatformId {
  try {
    const v = sessionStorage.getItem(PPC_PLATFORM_STORAGE_KEY);
    if (v === "google") return v;
  } catch {
    /* ignore */
  }
  return "google";
}

export function writeStoredPpcPlatform(platform: PpcPlatformId): void {
  try {
    sessionStorage.setItem(PPC_PLATFORM_STORAGE_KEY, platform);
  } catch {
    /* ignore */
  }
}
