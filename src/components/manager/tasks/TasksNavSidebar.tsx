import React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskProject, TasksNavMode } from "@/lib/tasks-types";
import { TaskProjectNavRow } from "@/components/manager/tasks/TaskProjectNavRow";

export type TasksNavSidebarProps = {
  navMode: TasksNavMode;
  activeProjectId: number | null;
  regularProjects: TaskProject[];
  onSelectMyTasks: () => void;
  onSelectProject: (projectId: number) => void;
  onNewProject: () => void;
  onEditProject: (project: TaskProject) => void;
  onDeleteProject: (projectId: number) => void;
  onOpenPulseForge?: () => void;
};

export function TasksNavSidebar({
  navMode,
  activeProjectId,
  regularProjects,
  onSelectMyTasks,
  onSelectProject,
  onNewProject,
  onEditProject,
  onDeleteProject,
  onOpenPulseForge,
}: TasksNavSidebarProps): React.ReactElement {
  return (
    <aside className="flex h-full min-h-0 w-52 shrink-0 flex-col bg-zinc-950">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-3">
        <button
          type="button"
          onClick={onSelectMyTasks}
          className={cn(
            "w-full px-2 py-2 text-left text-base font-medium",
            navMode === "my" ? "bg-zinc-800 text-white" : "text-muted-foreground hover:bg-zinc-900 hover:text-white",
          )}
        >
          My Tasks
        </button>
        {onOpenPulseForge ? (
          <button
            type="button"
            onClick={onOpenPulseForge}
            className="mt-2 w-full px-2 py-2 text-left text-base font-medium text-primary hover:bg-zinc-900"
          >
            Pulse Forge
          </button>
        ) : null}
        <div className="mt-4 flex items-center justify-between gap-2 px-2">
          <p className="text-base font-semibold text-white">Projects</p>
          <button
            type="button"
            onClick={onNewProject}
            className="flex h-8 w-8 shrink-0 items-center justify-center text-primary hover:opacity-90"
            aria-label="New project"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <ul className="mt-2 flex flex-col gap-0.5">
          {regularProjects.map((project) => (
            <li key={project.id}>
              <TaskProjectNavRow
                project={project}
                selected={navMode === "project" && activeProjectId === project.id}
                onSelect={() => onSelectProject(project.id)}
                onEdit={onEditProject}
                onDelete={onDeleteProject}
              />
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
