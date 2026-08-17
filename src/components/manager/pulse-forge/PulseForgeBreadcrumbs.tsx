import React from "react";
import { ChevronRight } from "lucide-react";
import type { PulseForgeRoute } from "@/lib/pulse-forge/pulse-forge-hash";
import { setPulseForgeHash } from "@/lib/pulse-forge/pulse-forge-hash";
import { cn } from "@/lib/utils";

type Crumb = {
  label: string;
  route: PulseForgeRoute | null;
};

const LINK_CLASS =
  "text-base font-normal text-muted-foreground underline-offset-4 hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600";

const SECTION_LABELS = {
  forge: "My Forge",
  recipes: "Agents",
  workflows: "Workflows",
} as const;

function buildCrumbs(
  route: PulseForgeRoute,
  recipeName: string | null | undefined,
  workflowName: string | null | undefined,
): Crumb[] {
  const crumbs: Crumb[] = [{ label: "Forge", route: { section: "forge" } }];

  if (route.section === "forge" && !("view" in route)) {
    crumbs.push({ label: SECTION_LABELS.forge, route: null });
    return crumbs;
  }

  if (route.section === "workflows") {
    crumbs.push({ label: SECTION_LABELS.workflows, route: { section: "workflows" } });
    if ("view" in route) {
      if (route.view === "new") {
        crumbs.push({ label: workflowName?.trim() || "New workflow", route: null });
      } else {
        crumbs.push({
          label: workflowName?.trim() || `Workflow ${route.workflowId}`,
          route: null,
        });
      }
    }
    return crumbs;
  }

  crumbs.push({
    label: SECTION_LABELS[route.section],
    route: { section: route.section },
  });

  if (route.section === "recipes" && "view" in route && route.view === "builder") {
    crumbs.push({
      label: recipeName?.trim() || route.recipeKeyword,
      route: { section: "recipes", view: "builder", recipeKeyword: route.recipeKeyword },
    });
  }

  return crumbs;
}

export type PulseForgeBreadcrumbsProps = {
  route: PulseForgeRoute;
  recipeName?: string | null;
  workflowName?: string | null;
  statusMessage?: string | null;
  /** When true, omit the leaf crumb (e.g. workflow name lives in an adjacent field). */
  hideLeaf?: boolean;
  className?: string;
};

export function PulseForgeBreadcrumbs({
  route,
  recipeName,
  workflowName,
  statusMessage,
  hideLeaf = false,
  className,
}: PulseForgeBreadcrumbsProps): React.ReactElement {
  const crumbs = buildCrumbs(route, recipeName, workflowName);
  const visibleCrumbs = hideLeaf && crumbs.length > 1 ? crumbs.slice(0, -1) : crumbs;

  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <nav aria-label="Breadcrumb" className="flex min-w-0 shrink-0 items-center gap-1 text-base font-normal text-white">
        {visibleCrumbs.map((crumb, index) => {
          const isLast = index === visibleCrumbs.length - 1;
          return (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
              {index > 0 ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/50" aria-hidden /> : null}
              {isLast || !crumb.route ? (
                <span className="font-normal text-white">{crumb.label}</span>
              ) : (
                <button
                  type="button"
                  onClick={() => setPulseForgeHash(crumb.route!)}
                  className={cn(LINK_CLASS, "border-0 bg-transparent p-0")}
                >
                  {crumb.label}
                </button>
              )}
            </span>
          );
        })}
      </nav>
      {statusMessage ? (
        <p className="ml-auto shrink-0 text-base text-red-400" role="status">
          {statusMessage}
        </p>
      ) : null}
    </div>
  );
}
