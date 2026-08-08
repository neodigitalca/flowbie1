import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { prefetchChatSession } from "@/lib/chat-session-cache";
import {
  fetchTeamMembers,
  fetchPendingInvites,
  fetchJobTitlePresets,
  fetchTeams,
  switchTeam as switchTeamApi,
} from "@/lib/teams-api";
import type { JobTitlePreset, TeamInvite, TeamMember, TeamPermissions, TeamSummary } from "@/lib/teams-types";

type TeamContextValue = {
  teams: TeamSummary[];
  activeTeam: TeamSummary | null;
  members: TeamMember[];
  invites: TeamInvite[];
  jobTitlePresets: JobTitlePreset[];
  permissions: TeamPermissions | null;
  loading: boolean;
  refresh: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  switchTeam: (teamId: number) => Promise<boolean>;
  setActiveTeamLocal: (team: TeamSummary | null) => void;
  setPermissionsLocal: (permissions: TeamPermissions | null) => void;
};

const TeamContext = createContext<TeamContextValue | null>(null);

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user, activeTeam: authActiveTeam, permissions: authPermissions, checkAuth, setActiveTeam: setAuthActiveTeam, setPermissions: setAuthPermissions } = useAuth();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [activeTeam, setActiveTeam] = useState<TeamSummary | null>(authActiveTeam);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [jobTitlePresets, setJobTitlePresets] = useState<JobTitlePreset[]>([]);
  const [permissions, setPermissions] = useState<TeamPermissions | null>(authPermissions);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setActiveTeam(authActiveTeam);
    setPermissions(authPermissions);
  }, [authActiveTeam, authPermissions]);

  useEffect(() => {
    if (!activeTeam?.id) return;
    void prefetchChatSession(activeTeam.id);
  }, [activeTeam?.id]);

  const refreshMembers = useCallback(async () => {
    if (!activeTeam) {
      setMembers([]);
      setInvites([]);
      setJobTitlePresets([]);
      return;
    }
    const [m, i, p] = await Promise.all([
      fetchTeamMembers(activeTeam.id),
      fetchPendingInvites(activeTeam.id),
      fetchJobTitlePresets(activeTeam.id),
    ]);
    setMembers(m);
    setInvites(i);
    setJobTitlePresets(p);
  }, [activeTeam]);

  const refresh = useCallback(async () => {
    if (!user) {
      setTeams([]);
      setActiveTeam(null);
      setPermissions(null);
      setMembers([]);
      setInvites([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await checkAuth();
      const list = await fetchTeams();
      setTeams(list);
      const current = list.find((t) => t.id === authActiveTeam?.id) ?? list[0] ?? authActiveTeam ?? null;
      if (current) {
        setActiveTeam(current);
        setPermissions(current.permissions ?? authPermissions);
        setAuthActiveTeam(current);
        setAuthPermissions(current.permissions ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [user, checkAuth, authActiveTeam, authPermissions, setAuthActiveTeam, setAuthPermissions]);

  useEffect(() => {
    void refresh();
  }, [user?.id]);

  useEffect(() => {
    void refreshMembers();
  }, [refreshMembers]);

  const switchTeam = useCallback(
    async (teamId: number) => {
      const r = await switchTeamApi(teamId);
      if (!r.ok || !r.team) return false;
      setActiveTeam(r.team);
      setPermissions(r.team.permissions ?? null);
      setAuthActiveTeam(r.team);
      setAuthPermissions(r.team.permissions ?? null);
      await refreshMembers();
      return true;
    },
    [refreshMembers, setAuthActiveTeam, setAuthPermissions],
  );

  const value = useMemo(
    () => ({
      teams,
      activeTeam,
      members,
      invites,
      jobTitlePresets,
      permissions,
      loading,
      refresh,
      refreshMembers,
      switchTeam,
      setActiveTeamLocal: (team: TeamSummary | null) => {
        setActiveTeam(team);
        setAuthActiveTeam(team);
      },
      setPermissionsLocal: (p: TeamPermissions | null) => {
        setPermissions(p);
        setAuthPermissions(p);
      },
    }),
    [
      teams,
      activeTeam,
      members,
      invites,
      jobTitlePresets,
      permissions,
      loading,
      refresh,
      refreshMembers,
      switchTeam,
      setAuthActiveTeam,
      setAuthPermissions,
    ],
  );

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error("useTeam must be used within TeamProvider");
  return ctx;
}
