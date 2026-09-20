import type { AssistCardLink, AssistNavigateTarget } from "./types";
import { isPulseForgeHash, parsePulseForgeRouteFromHash } from "@/lib/pulse-forge/pulse-forge-hash";

export const PULSE_NAV_PREFIX = "pulse:nav/";

const HASH_TAB_ALIASES: Record<string, string> = {
  settings: "dashboard",
};

export function isPulseAssistHref(href: string): boolean {
  return href.startsWith(PULSE_NAV_PREFIX);
}

export function parsePulseAssistHref(href: string): AssistNavigateTarget | null {
  if (!isPulseAssistHref(href)) return null;
  const path = href.slice(PULSE_NAV_PREFIX.length);
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "generator" && parts[1]) {
    return { kind: "generatorSection", section: parts[1] };
  }
  if (parts[0] === "dashboard" && parts[1]) {
    return { kind: "dashboardCluster", cluster: parts[1] };
  }
  if (parts[0] === "pulse-forge") {
    return { kind: "pulseForge", hash: parts.join("/") };
  }
  if (parts.length === 1) {
    return { kind: "managerTab", tab: parts[0] };
  }
  return null;
}

/** Parse in-app hash or pulse:nav href for Assist markdown/card links. */
export function parseAppHref(href: string): AssistNavigateTarget | null {
  const pulse = parsePulseAssistHref(href);
  if (pulse) return pulse;

  let hash = href.trim();
  try {
    if (hash.includes("#")) {
      const url = new URL(hash, typeof window !== "undefined" ? window.location.origin : "https://neodigital.ca");
      hash = url.hash;
    }
  } catch {
    /* relative hash only */
  }

  if (!hash.startsWith("#")) return null;
  const segment = hash.slice(1).split("/")[0]?.trim() ?? "";
  if (!segment) return null;

  if (segment.startsWith("m")) return null;

  const normalized = HASH_TAB_ALIASES[segment] ?? segment;
  if (normalized === "generator") {
    return { kind: "managerTab", tab: "generator" };
  }
  if (normalized === "pulse-forge" || isPulseForgeHash(hash)) {
    return { kind: "pulseForge", hash: hash.replace(/^#/, "") };
  }
  return { kind: "managerTab", tab: normalized };
}

export function isInAppAssistHref(href: string): boolean {
  return isPulseAssistHref(href) || parseAppHref(href) !== null;
}

/** Pull navigate links from Assist markdown bodies like `[Overview](pulse:nav/generator/opt)`. */
export function extractPulseNavLinksFromMarkdown(body: string): AssistCardLink[] {
  const links: AssistCardLink[] = [];
  const re = /\[([^\]]+)\]\((pulse:nav\/[^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    links.push({
      label: match[1],
      url: match[2],
      action: "navigate",
    });
  }
  return links;
}

export type AssistNavigationHandlers = {
  onManagerTabChange: (tab: string) => void;
  onGeneratorSectionChange: (section: string) => void;
  onDashboardClusterChange: (cluster: string) => void;
  onPulseForgeHash?: (hash: string) => void;
};

export function executeAssistNavigation(
  target: AssistNavigateTarget,
  handlers: AssistNavigationHandlers,
): void {
  if (target.kind === "managerTab") {
    handlers.onManagerTabChange(target.tab);
    return;
  }
  if (target.kind === "generatorSection") {
    handlers.onManagerTabChange("generator");
    handlers.onGeneratorSectionChange(target.section);
    return;
  }
  if (target.kind === "dashboardCluster") {
    handlers.onManagerTabChange("dashboard");
    handlers.onDashboardClusterChange(target.cluster);
    return;
  }
  if (target.kind === "pulseForge") {
    handlers.onManagerTabChange("pulse-forge");
    handlers.onPulseForgeHash?.(target.hash);
  }
}

export function forgeContextFromHash(rawHash?: string): {
  forgeSection?: string;
  forgeWorkflowId?: number;
  forgeRecipeKeyword?: string;
} {
  if (!isPulseForgeHash(rawHash)) return {};
  const route = parsePulseForgeRouteFromHash(rawHash);
  const forgeSection = route.section;
  if (route.section === "recipes" && "view" in route && route.view === "builder") {
    return {
      forgeSection,
      forgeRecipeKeyword: route.recipeKeyword,
      forgeWorkflowId: route.workflowId,
    };
  }
  if (route.section === "workflows" && "view" in route && route.view === "edit") {
    return { forgeSection, forgeWorkflowId: route.workflowId };
  }
  return { forgeSection };
}
