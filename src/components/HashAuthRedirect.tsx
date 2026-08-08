import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/** Redirect `/#register?invite=…` to `/register?invite=…`. */
export function HashAuthRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "").trim();
    if (!raw.startsWith("register")) return;
    const query = raw.includes("?") ? raw.slice(raw.indexOf("?")) : "";
    navigate(`/register${query}`, { replace: true });
  }, [navigate]);

  return null;
}
