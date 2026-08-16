import React from "react";
import { cn } from "@/lib/utils";
import { TaskProjectNavRow } from "@/components/manager/tasks/TaskProjectNavRow";
import type { TaskProject } from "@/lib/tasks-types";

export type PulseForgeNavMode = "recipes" | "forge";

export type PulseForgeNavSidebarProps = {
  navMode: PulseForgeNavMode;
  activeProjectId: number | null;
  automationProjects: TaskProject[];
  onSelectRecipes: () => void;
  onSelectAutomation: (projectId: number) => void;
  onNewAutomation: () => void;
  onEditAutomation: (project: TaskProject) => void;
  onDeleteAutomation: (projectId: number) => void;
};

export function PulseForgeNavSidebar({
  navMode,
  activeProjectId,
  automationProjects,
  onSelectRecipes,
  onSelectAutomation,
  onNewAutomation,
  onEditAutomation,
  onDeleteAutomation,
}: PulseForgeNavSidebarProps): React.ReactElement {
  return (
    <aside className="flex h-full min-h-0 w-52 shrink-0 flex-col bg-zinc-950">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <button
          type="button"
          onClick={onSelectRecipes}
          className={cn(
            "w-full px-3 py-2 text-left text-base font-semibold",
            navMode === "recipes"
              ? "bg-zinc-900 text-muted-foreground"
              : "text-muted-foreground hover:bg-zinc-900 hover:text-white",
          )}
        >
          Recipes
        </button>
        <div className="mt-0 flex items-center justify-between gap-2 px-3 py-2">
          <p className="text-base font-semibold text-muted-foreground">My Forge</p>
          <button
            type="button"
            onClick={onNewAutomation}
            className="text-base text-muted-foreground hover:text-white"
          >
            New
          </button>
        </div>
        <ul className="flex flex-col gap-0.5 px-2 pb-3">
          {automationProjects.map((project) => (
            <li key={project.id}>
              <TaskProjectNavRow
                project={project}
                selected={navMode === "forge" && activeProjectId === project.id}
                onSelect={() => onSelectAutomation(project.id)}
                onEdit={onEditAutomation}
                onDelete={onDeleteAutomation}
                deleteLabel="Delete automation"
              />
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
