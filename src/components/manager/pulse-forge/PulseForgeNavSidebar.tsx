import React from "react";
import { Plus } from "lucide-react";
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
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-3">
        <button
          type="button"
          onClick={onSelectRecipes}
          className={cn(
            "w-full px-2 py-2 text-left text-base font-medium",
            navMode === "recipes" ? "bg-zinc-800 text-white" : "text-muted-foreground hover:bg-zinc-900 hover:text-white",
          )}
        >
          Recipes
        </button>
        <div className="mt-4 flex items-center justify-between gap-2 px-2">
          <p className="text-base font-semibold text-white">My Forge</p>
          <button
            type="button"
            onClick={onNewAutomation}
            className="flex h-8 w-8 shrink-0 items-center justify-center text-primary hover:opacity-90"
            aria-label="New automation"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <ul className="mt-2 flex flex-col gap-0.5">
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
