import React from "react";
import type { TaskNote } from "@/lib/tasks-types";

export type TaskNotesListProps = {
  notes: TaskNote[];
  memberNames: Map<number, string>;
};

export function TaskNotesList({ notes, memberNames }: TaskNotesListProps): React.ReactElement {
  if (notes.length === 0) {
    return <p className="text-base text-muted-foreground">No notes yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {notes.map((note) => (
        <li key={note.id} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-base font-medium text-white">
              {memberNames.get(note.authorId) ?? `User ${note.authorId}`}
            </span>
            <span className="text-base text-muted-foreground">{note.createdAt}</span>
          </div>
          <p className="whitespace-pre-wrap text-base text-muted-foreground">{note.body}</p>
        </li>
      ))}
    </ul>
  );
}
