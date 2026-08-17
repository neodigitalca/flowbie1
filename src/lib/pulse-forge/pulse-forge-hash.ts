import { useEffect, useState } from "react";

export type PulseForgeNavMode = "forge" | "recipes" | "workflows";

const VALID_SECTIONS = new Set<PulseForgeNavMode>(["forge", "recipes", "workflows"]);

export type PulseForgeRoute =
  | { section: "forge" }
  | { section: "recipes" }
  | { section: "recipes"; view: "builder"; recipeKeyword: string }
  | { section: "workflows" }
  | { section: "workflows"; view: "new" }
  | { section: "workflows"; view: "edit"; workflowId: number };

function normalizeHashBody(rawHash?: string): string {
  return (rawHash ?? (typeof window !== "undefined" ? window.location.hash : ""))
    .replace(/^#/, "")
    .trim()
    .replace(/^\//, "");
}

export function isPulseForgeHash(rawHash?: string): boolean {
  const raw = normalizeHashBody(rawHash);
  return raw === "pulse-forge" || raw.startsWith("pulse-forge/");
}

export function pulseForgeNavModeFromRoute(route: PulseForgeRoute): PulseForgeNavMode {
  return route.section;
}

function normalizeLegacySection(sectionRaw: string): PulseForgeNavMode {
  if (sectionRaw === "automations") return "workflows";
  if (VALID_SECTIONS.has(sectionRaw as PulseForgeNavMode)) return sectionRaw as PulseForgeNavMode;
  return "forge";
}

export function parsePulseForgeRouteFromHash(rawHash?: string): PulseForgeRoute {
  const raw = normalizeHashBody(rawHash);
  if (raw === "pulse-forge" || raw === "pulse-forge/forge") {
    return { section: "forge" };
  }

  const parts = raw.split("/").filter(Boolean);
  if (parts[0] !== "pulse-forge") {
    return { section: "forge" };
  }

  const section = normalizeLegacySection(parts[1] ?? "forge");

  if (section === "recipes") {
    if (!parts[2]) return { section: "recipes" };
    return { section: "recipes", view: "builder", recipeKeyword: decodeURIComponent(parts[2]) };
  }

  if (section === "workflows") {
    if (!parts[2]) return { section: "workflows" };
    if (parts[2] === "new") return { section: "workflows", view: "new" };
    const workflowId = Number(parts[2]);
    if (Number.isFinite(workflowId) && workflowId > 0) {
      return { section: "workflows", view: "edit", workflowId };
    }
    return { section: "workflows" };
  }

  return { section: "forge" };
}

export function buildPulseForgeHash(route: PulseForgeRoute): string {
  if (route.section === "forge") return "pulse-forge/forge";
  if (route.section === "recipes") {
    if ("view" in route && route.view === "builder") {
      return `pulse-forge/recipes/${encodeURIComponent(route.recipeKeyword)}`;
    }
    return "pulse-forge/recipes";
  }
  if (route.section === "workflows") {
    if ("view" in route && route.view === "new") return "pulse-forge/workflows/new";
    if ("view" in route && route.view === "edit") {
      return `pulse-forge/workflows/${route.workflowId}`;
    }
    return "pulse-forge/workflows";
  }
  return "pulse-forge/forge";
}

export function setPulseForgeHash(route: PulseForgeRoute): void {
  const hash = buildPulseForgeHash(route);
  const url = `${window.location.pathname}${window.location.search}#${hash}`;
  if (window.location.hash.replace(/^#/, "") === hash) return;
  window.history.replaceState(null, "", url);
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

export function usePulseForgeRoute(): PulseForgeRoute {
  const [route, setRoute] = useState<PulseForgeRoute>(() => parsePulseForgeRouteFromHash());

  useEffect(() => {
    const onHash = () => setRoute(parsePulseForgeRouteFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const raw = normalizeHashBody();
    if (raw === "pulse-forge") {
      setPulseForgeHash({ section: "forge" });
    }
    if (raw.startsWith("pulse-forge/automations")) {
      const migrated = raw.replace("pulse-forge/automations", "pulse-forge/workflows");
      setPulseForgeHash(parsePulseForgeRouteFromHash(migrated));
    }
  }, []);

  return route;
}
