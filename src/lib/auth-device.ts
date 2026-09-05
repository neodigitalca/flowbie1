const STORAGE_KEY = "neo-pulse_device_auth";
const SESSION_TOKEN_KEY = "neo_pulse_session_token";

let memorySessionToken: string | null = null;

export type DeviceAuth = {
  email: string;
  password: string;
  sessionToken?: string;
};

function hasBrowserStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

export function setSessionToken(sessionToken: string | null): void {
  memorySessionToken = sessionToken;
  if (!hasBrowserStorage()) return;
  if (sessionToken) {
    sessionStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
    return;
  }
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
}

export function getSessionToken(): string | null {
  if (memorySessionToken) return memorySessionToken;
  if (hasBrowserStorage()) {
    const fromSession = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (fromSession) {
      memorySessionToken = fromSession;
      return fromSession;
    }
  }
  return loadDeviceAuth()?.sessionToken?.trim() || null;
}

export function loadDeviceAuth(): DeviceAuth | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeviceAuth;
    if (!parsed.email || !parsed.password) return null;
    return {
      email: parsed.email,
      password: parsed.password,
      sessionToken: parsed.sessionToken,
    };
  } catch {
    return null;
  }
}

export function saveDeviceAuth(email: string, password: string, sessionToken?: string): void {
  if (typeof localStorage === "undefined") {
    if (sessionToken) setSessionToken(sessionToken);
    return;
  }
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      email,
      password,
      ...(sessionToken ? { sessionToken } : {}),
    }),
  );
  if (sessionToken) {
    setSessionToken(sessionToken);
  }
}

export function saveSessionToken(sessionToken: string): void {
  const existing = loadDeviceAuth();
  if (existing) {
    saveDeviceAuth(existing.email, existing.password, sessionToken);
    return;
  }
  setSessionToken(sessionToken);
}

export function loadSessionToken(): string | null {
  return getSessionToken();
}

export function clearDeviceAuth(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
  setSessionToken(null);
}
