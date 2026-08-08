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
import { Textarea } from "@/components/ui/textarea";
import { DASHBOARD_SETTINGS_FIELD_CLASS } from "@/components/manager/dashboard/dashboard-panel-styles";
import type { TaskProject, TaskTemplate } from "@/lib/tasks-types";

const INPUT_CLASS = `${DASHBOARD_SETTINGS_FIELD_CLASS} min-w-0 w-full h-12`;

export type NewProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: TaskTemplate[];
  editProject?: TaskProject | null;
  onCreate: (payload: {
    keyword: string;
    title: string;
    description?: string;
    defaultTasks?: Array<{ keyword?: string; title: string; status?: "todo" }>;
  }) => Promise<boolean>;
  onUpdate?: (
    projectId: number,
    payload: { keyword: string; title: string; description?: string },
  ) => Promise<boolean>;
};

export function NewProjectDialog({
  open,
  onOpenChange,
  templates,
  editProject = null,
  onCreate,
  onUpdate,
}: NewProjectDialogProps): React.ReactElement {
  const [keyword, setKeyword] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [templateKeyword, setTemplateKeyword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = editProject != null;

  const reset = useCallback(() => {
    setKeyword("");
    setTitle("");
    setDescription("");
    setTemplateKeyword("");
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (editProject) {
      setKeyword(editProject.keyword);
      setTitle(editProject.title);
      setDescription(editProject.description ?? "");
      setTemplateKeyword("");
      setError(null);
    } else {
      reset();
    }
  }, [editProject, open, reset]);

  const handleTemplatePick = useCallback(
    (kw: string) => {
      setTemplateKeyword(kw);
      const tpl = templates.find((t) => t.keyword === kw);
      if (!tpl) return;
      setKeyword(tpl.keyword);
      setTitle(tpl.name);
    },
    [templates],
  );

  const handleSubmit = useCallback(async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      keyword: keyword.trim() || trimmedTitle.toLowerCase().replace(/\s+/g, "-"),
      title: trimmedTitle,
      description: description.trim() || undefined,
    };
    let ok = false;
    if (isEdit && editProject && onUpdate) {
      ok = await onUpdate(editProject.id, payload);
      if (!ok) setError("Could not update project.");
    } else {
      const tpl = templates.find((t) => t.keyword === templateKeyword);
      ok = await onCreate({ ...payload, defaultTasks: tpl?.defaultTasks });
      if (!ok) setError("Could not create project.");
    }
    setSaving(false);
    if (!ok) return;
    reset();
    onOpenChange(false);
  }, [
    description,
    editProject,
    isEdit,
    keyword,
    onCreate,
    onOpenChange,
    onUpdate,
    reset,
    templateKeyword,
    templates,
    title,
  ]);

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
            {isEdit ? "Edit project" : "New project"}
          </DialogTitle>
        </DialogHeader>
        {!isEdit && templates.length > 0 ? (
          <div className="flex flex-col gap-2">
            <label className="text-base text-muted-foreground">Template</label>
            <select
              value={templateKeyword}
              onChange={(e) => handleTemplatePick(e.target.value)}
              className={`${INPUT_CLASS} px-3`}
            >
              <option value="">Blank project</option>
              {templates.map((tpl) => (
                <option key={tpl.keyword} value={tpl.keyword}>
                  {tpl.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Keyword"
          aria-label="Project keyword"
          className={INPUT_CLASS}
          disabled={saving}
        />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Project title"
          aria-label="Project title"
          className={INPUT_CLASS}
          disabled={saving}
        />
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          aria-label="Project description"
          className={`${DASHBOARD_SETTINGS_FIELD_CLASS} min-h-24 w-full text-base`}
          disabled={saving}
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
