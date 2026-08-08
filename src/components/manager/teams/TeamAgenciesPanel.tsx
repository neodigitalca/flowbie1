import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DASHBOARD_SETTINGS_GROUP_CLASS } from "@/components/manager/dashboard/dashboard-panel-styles";
import { NewAgencyDialog } from "@/components/manager/teams/NewAgencyDialog";
import { useTeam } from "@/contexts/TeamContext";
import { cn } from "@/lib/utils";

export function TeamAgenciesPanel() {
  const { teams, activeTeam, switchTeam, refresh } = useTeam();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<number | null>(null);

  const handleSwitch = useCallback(
    async (teamId: number) => {
      if (activeTeam?.id === teamId) return;
      setSwitchingId(teamId);
      setSwitchError(null);
      try {
        const ok = await switchTeam(teamId);
        if (!ok) {
          setSwitchError("Could not switch agency.");
          return;
        }
        await refresh();
      } finally {
        setSwitchingId(null);
      }
    },
    [activeTeam?.id, refresh, switchTeam],
  );

  if (teams.length === 0) return null;

  return (
    <div className={DASHBOARD_SETTINGS_GROUP_CLASS}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold text-white">Agencies</p>
        <Button
          type="button"
          variant="outline"
          className="h-12 gap-1.5 text-base"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="h-4 w-4" aria-hidden />
          New agency
        </Button>
      </div>
      <div className="space-y-2">
        {teams.map((team) => {
          const active = activeTeam?.id === team.id;
          return (
            <div
              key={team.id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 px-3 py-2.5",
                active ? "bg-primary text-black" : "bg-zinc-900/55 text-white",
              )}
            >
              <div className="min-w-0 space-y-1">
                <p className="font-semibold">{team.name}</p>
                <p className={cn("text-base capitalize", active ? "text-black" : "text-white")}>
                  {team.accessRole}
                </p>
              </div>
              {active ? (
                <span className="text-base font-normal">Active</span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 text-base"
                  disabled={switchingId === team.id}
                  onClick={() => void handleSwitch(team.id)}
                >
                  {switchingId === team.id ? "Switching…" : "Switch"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      {switchError ? <p className="text-base text-red-400">{switchError}</p> : null}
      <NewAgencyDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
