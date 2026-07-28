import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FloatingLabelInput } from "@/components/ui/floating-label-input";
import { useAuth } from "@/contexts/AuthContext";
import { AUTH_DISABLED } from "@/lib/auth-disabled";
import { Lock, User, LogIn } from "lucide-react";

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (AUTH_DISABLED) {
      navigate("/", { replace: true });
      return;
    }
    if (!loading && user) navigate("/", { replace: true });
  }, [user, loading, navigate]);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await login(username.trim(), password);
      if (result.ok) {
        navigate("/", { replace: true });
      } else {
        setError(result.error || "Invalid credentials");
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="flowbie-panel-neon w-full max-w-sm space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground">Flowbie</h1>
          <p className="text-muted-foreground mt-1">Sign in to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-dashboard">
          <div className="relative w-full">
            <div className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
            <FloatingLabelInput
              id="username"
              label="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border-0 bg-black pl-10 focus-visible:ring-primary/55 focus-visible:ring-offset-0"
              labelClassName="pl-10"
              autoComplete="username"
              required
            />
          </div>
          <div className="relative w-full">
            <div className="pointer-events-none absolute inset-y-0 left-3 z-10 flex items-center">
              <Lock className="h-4 w-4 text-muted-foreground" />
            </div>
            <FloatingLabelInput
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border-0 bg-black pl-10 focus-visible:ring-primary/55 focus-visible:ring-offset-0"
              labelClassName="pl-10"
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={submitting}>
            <LogIn className="mr-2 h-4 w-4" />
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
