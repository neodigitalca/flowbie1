import { getDefaultApiDocSlug } from "@/lib/api-docs/index";
import { useEffect, useState } from "react";

export function isApiTabHash(rawHash?: string): boolean {
  const raw = (rawHash ?? window.location.hash.replace(/^#/, "")).trim();
  return raw === "api" || raw.startsWith("api/") || raw === "api-docs" || raw.startsWith("api-docs/");
}

export function readApiDocsSlugFromHash(): string {
  const raw = window.location.hash.replace(/^#/, "").trim();
  if (raw === "api" || raw === "api-docs") return getDefaultApiDocSlug();
  const match = raw.match(/^(?:api|api-docs)\/(.+)$/);
  if (match?.[1]) return match[1];
  return getDefaultApiDocSlug();
}

export function setApiDocsHash(slug: string): void {
  const path = `${window.location.pathname}${window.location.search}`;
  const normalized = slug.replace(/^\/+|\/+$/g, "") || getDefaultApiDocSlug();
  const hash =
    normalized === getDefaultApiDocSlug() ? "api" : `api/${normalized}`;
  if (window.location.hash.replace(/^#/, "") !== hash) {
    window.history.replaceState(null, "", `${path}#${hash}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
}

export function useApiDocsSlug(): string {
  const [slug, setSlug] = useState(() => readApiDocsSlugFromHash());

  useEffect(() => {
    const onHash = () => setSlug(readApiDocsSlugFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return slug;
}
