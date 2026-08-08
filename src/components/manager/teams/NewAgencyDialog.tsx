import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DASHBOARD_SETTINGS_FIELD_CLASS } from "@/components/manager/dashboard/dashboard-panel-styles";
import { useTeam } from "@/contexts/TeamContext";
import { createTeam } from "@/lib/teams-api";
import {
  DEFAULT_OWNER_JOB_TITLE,
  DEFAULT_TEAM_NAME,
} from "@/lib/teams-types";

const INPUT_CLASS = `${DASHBOARD_SETTINGS_FIELD_CLASS} min-w-0 w-full h-12`;

export type NewAgencyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NewAgencyDialog({ open, onOpenChange }: NewAgencyDialogProps) {
  const { refresh } = useTeam();
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Agency name is required.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const r = await createTeam({
        name: trimmed,
        jobTitle: DEFAULT_OWNER_JOB_TITLE,
      });
      if (!r.ok) {
        setError(r.error || "Could not create agency.");
        return;
      }
      setName("");
      onOpenChange(false);
      await refresh();
    } finally {
      setCreating(false);
    }
  }, [name, onOpenChange, refresh]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-none border-0 bg-zinc-950 p-6 text-white">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-white">New agency</DialogTitle>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={DEFAULT_TEAM_NAME}
          aria-label="Agency name"
          className={INPUT_CLASS}
          disabled={creating}
        />
        {error ? <p className="text-base text-red-400">{error}</p> : null}
        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-12 text-base"
            disabled={creating}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" className="h-12 text-base" disabled={creating} onClick={() => void handleCreate()}>
            {creating ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
