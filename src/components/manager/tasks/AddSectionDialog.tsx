import React, { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DASHBOARD_SETTINGS_FIELD_CLASS } from "@/components/manager/dashboard/dashboard-panel-styles";
import { cn } from "@/lib/utils";
import type { TaskSection } from "@/lib/tasks-types";

const INPUT_CLASS = `${DASHBOARD_SETTINGS_FIELD_CLASS} min-w-0 w-full h-12`;

const SECTION_PRESETS = ["To do", "In progress", "Review", "Done"] as const;

export type AddSectionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editSection?: TaskSection | null;
  onCreate: (payload: { keyword: string; title: string }) => Promise<boolean>;
  onUpdate?: (sectionId: number, payload: { keyword: string; title: string }) => Promise<boolean>;
};

export function AddSectionDialog({
  open,
  onOpenChange,
  editSection = null,
  onCreate,
  onUpdate,
}: AddSectionDialogProps): React.ReactElement {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = editSection != null;

  const reset = useCallback(() => {
    setTitle("");
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (editSection) {
      setTitle(editSection.title);
      setError(null);
    } else {
      reset();
    }
  }, [editSection, open, reset]);

  const handleSubmit = useCallback(async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Section name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      keyword: trimmedTitle.toLowerCase().replace(/\s+/g, "-"),
      title: trimmedTitle,
    };
    let ok = false;
    if (isEdit && editSection && onUpdate) {
      ok = await onUpdate(editSection.id, payload);
      if (!ok) setError("Could not update section.");
    } else {
      ok = await onCreate(payload);
      if (!ok) setError("Could not create section.");
    }
    setSaving(false);
    if (!ok) return;
    reset();
    onOpenChange(false);
  }, [editSection, isEdit, onCreate, onOpenChange, onUpdate, reset, title]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md rounded-none border-0 bg-zinc-950 p-6 text-white">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-white">
            {isEdit ? "Edit section" : "Add section"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {SECTION_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={saving}
              onClick={() => setTitle(preset)}
              className={cn(
                "px-3 py-1.5 text-base",
                title === preset ? "bg-primary text-black" : "bg-zinc-800 text-white hover:bg-zinc-700",
              )}
            >
              {preset}
            </button>
          ))}
        </div>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Section name"
          aria-label="Section name"
          className={INPUT_CLASS}
          disabled={saving}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSubmit();
          }}
        />
        {error ? <p className="text-base text-red-400">{error}</p> : null}
        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-12 text-base"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" className="h-12 text-base" disabled={saving} onClick={() => void handleSubmit()}>
            {saving ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
