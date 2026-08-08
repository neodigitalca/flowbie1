import React, { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskProject } from "@/lib/tasks-types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type TaskProjectNavRowProps = {
  project: TaskProject;
  selected: boolean;
  onSelect: () => void;
  onEdit: (project: TaskProject) => void;
  onDelete: (projectId: number) => void;
};

export function TaskProjectNavRow({
  project,
  selected,
  onSelect,
  onEdit,
  onDelete,
}: TaskProjectNavRowProps): React.ReactElement {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div
      className={cn(
        "group flex items-center gap-0.5",
        selected ? "bg-zinc-800" : "hover:bg-zinc-900",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "min-w-0 flex-1 px-2 py-2 text-left text-base",
          selected ? "text-white" : "text-muted-foreground group-hover:text-white",
        )}
      >
        {project.title}
      </button>
      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          aria-label={`Edit ${project.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(project);
          }}
          className="flex h-8 w-7 items-center justify-center text-muted-foreground hover:text-white"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={`Delete ${project.title}`}
          onClick={(e) => {
            e.stopPropagation();
            setDeleteOpen(true);
          }}
          className="flex h-8 w-7 items-center justify-center text-muted-foreground hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-none border-0 bg-zinc-950 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Delete project</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-muted-foreground">
              Delete &quot;{project.title}&quot;? It will be removed from your project list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10 text-base">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="h-10 bg-red-600 text-base hover:bg-red-700"
              onClick={() => onDelete(project.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
