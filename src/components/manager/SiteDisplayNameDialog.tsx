import { useCallback, useEffect, useState } from "react";
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
import type { WordPressSite } from "@/components/integrations/types";
import { wordpressSiteDisplayName } from "@/lib/wordpress-site-display-name";

const INPUT_CLASS = `${DASHBOARD_SETTINGS_FIELD_CLASS} min-w-0 w-full h-12`;

export type SiteDisplayNameDialogProps = {
  open: boolean;
  site: WordPressSite | null;
  onOpenChange: (open: boolean) => void;
  onSave: (siteId: string, name: string) => void;
};

export function SiteDisplayNameDialog({
  open,
  site,
  onOpenChange,
  onSave,
}: SiteDisplayNameDialogProps) {
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open || !site) return;
    setName(wordpressSiteDisplayName(site));
  }, [open, site]);

  const trimmedName = name.trim();
  const canSave = Boolean(site && trimmedName);

  const handleSave = useCallback(() => {
    if (!site || !trimmedName) return;
    onSave(site.id, trimmedName);
    onOpenChange(false);
  }, [onOpenChange, onSave, site, trimmedName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-none border-0 bg-zinc-950 p-6 text-white">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-white">Display name</DialogTitle>
        </DialogHeader>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="Display name"
          className={INPUT_CLASS}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Enter" && canSave) {
              event.preventDefault();
              handleSave();
            }
          }}
        />
        <DialogFooter className="gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-12 text-base"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" className="h-12 text-base" disabled={!canSave} onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
