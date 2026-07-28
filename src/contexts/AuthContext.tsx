import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { clearAllMasterInstructionsMemory } from "@/lib/master-instructions-storage";
import { AUTH_DISABLED } from "@/lib/auth-disabled";

type User = { username: string } | null;

type AuthContextValue = {
  user: User;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// In production (e.g. Render), frontend and API are different origins - use backend URL from env
const AUTH_API_BASE =
  import.meta.env.VITE_MCP_API_BASE?.replace(/\/api\/mcp\/?$/, "") || "";

const api = (path: string, options?: RequestInit) =>
  fetch(`${AUTH_API_BASE}${path}`, { ...options, credentials: "include" });

const DEV_ADMIN_USER: User = { username: "admin" };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(AUTH_DISABLED ? DEV_ADMIN_USER : null);
  const [loading, setLoading] = useState(!AUTH_DISABLED);

  const checkAuth = useCallback(async () => {
    if (AUTH_DISABLED) {
      setUser(DEV_ADMIN_USER);
      setLoading(false);
      return;
    }
    try {
      const res = await api("/api/auth/me");
      if (res.ok) {
        const data = (await res.json()) as { username?: string | null };
        if (data && typeof data.username === "string" && data.username.length > 0) {
          setUser({ username: data.username });
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(async (username: string, password: string) => {
    if (AUTH_DISABLED) {
      setUser(DEV_ADMIN_USER);
      return { ok: true };
    }
    const res = await api("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      setUser(data.user ?? { username });
      return { ok: true };
    }
    return { ok: false, error: data.error || "Login failed" };
  }, []);

  const logout = useCallback(async () => {
    if (AUTH_DISABLED) {
      setUser(DEV_ADMIN_USER);
      return;
    }
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
    clearAllMasterInstructionsMemory();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
