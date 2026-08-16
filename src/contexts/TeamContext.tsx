import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { prefetchChatSession } from "@/lib/chat-session-cache";
import { readTeamMembersCache, prefetchTeamMembers, writeTeamMembersCache } from "@/lib/team-members-cache";
import { readTasksWorkspaceCache, writeTasksWorkspaceCache } from "@/lib/tasks-workspace-cache";
import {
  fetchMyTasks,
  fetchProjectFiles,
  fetchProjectSections,
  fetchProjectTasks,
  fetchTaskProjects,
  fetchTaskTags,
  fetchTaskTemplates,
} from "@/lib/tasks-api";
import type { TaskFile, TaskProject, TaskSection, TaskTag, TaskTemplate, TeamTask } from "@/lib/tasks-types";
import {
  fetchTeamMembers,
  fetchPendingInvites,
  fetchJobTitlePresets,
  fetchTeams,
  switchTeam as switchTeamApi,
} from "@/lib/teams-api";
import type { JobTitlePreset, TeamInvite, TeamMember, TeamPermissions, TeamSummary } from "@/lib/teams-types";

export type TaskProjectBundle = {
  tasks: TeamTask[];
  sections: TaskSection[];
  files: TaskFile[];
};

type TeamContextValue = {
  teams: TeamSummary[];
  activeTeam: TeamSummary | null;
  members: TeamMember[];
  invites: TeamInvite[];
  jobTitlePresets: JobTitlePreset[];
  permissions: TeamPermissions | null;
  loading: boolean;
  taskProjects: TaskProject[];
  taskTags: TaskTag[];
  taskTemplates: TaskTemplate[];
  myTasks: TeamTask[];
  completedToday: number;
  projectBundles: Record<number, TaskProjectBundle>;
  refresh: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  refreshTasksWorkspace: () => Promise<void>;
  refreshProjectBundle: (projectId: number) => Promise<void>;
  setMyTasks: React.Dispatch<React.SetStateAction<TeamTask[]>>;
  setTaskProjects: React.Dispatch<React.SetStateAction<TaskProject[]>>;
  setTaskTags: React.Dispatch<React.SetStateAction<TaskTag[]>>;
  setTaskTemplates: React.Dispatch<React.SetStateAction<TaskTemplate[]>>;
  setCompletedToday: React.Dispatch<React.SetStateAction<number>>;
  updateProjectBundle: (projectId: number, patch: Partial<TaskProjectBundle>) => void;
  purgeProjectBundle: (projectId: number) => void;
  switchTeam: (teamId: number) => Promise<boolean>;
  setActiveTeamLocal: (team: TeamSummary | null) => void;
  setPermissionsLocal: (permissions: TeamPermissions | null) => void;
};

const TeamContext = createContext<TeamContextValue | null>(null);

function emptyProjectBundle(): TaskProjectBundle {
  return { tasks: [], sections: [], files: [] };
}

export function TeamProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, activeTeam: authActiveTeam, permissions: authPermissions, checkAuth, setActiveTeam: setAuthActiveTeam, setPermissions: setAuthPermissions } = useAuth();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [activeTeam, setActiveTeam] = useState<TeamSummary | null>(authActiveTeam);
  const [members, setMembers] = useState<TeamMember[]>(() => {
    const id = authActiveTeam?.id;
    if (!id) return [];
    return readTeamMembersCache(id)?.members ?? [];
  });
  const [invites, setInvites] = useState<TeamInvite[]>(() => {
    const id = authActiveTeam?.id;
    if (!id) return [];
    return readTeamMembersCache(id)?.invites ?? [];
  });
  const [jobTitlePresets, setJobTitlePresets] = useState<JobTitlePreset[]>(() => {
    const id = authActiveTeam?.id;
    if (!id) return [];
    return readTeamMembersCache(id)?.jobTitlePresets ?? [];
  });
  const [permissions, setPermissions] = useState<TeamPermissions | null>(authPermissions);
  const [loading, setLoading] = useState(true);
  const [taskProjects, setTaskProjects] = useState<TaskProject[]>(() => {
    const id = authActiveTeam?.id;
    if (!id) return [];
    return readTasksWorkspaceCache(id)?.projects ?? [];
  });
  const [taskTags, setTaskTags] = useState<TaskTag[]>(() => {
    const id = authActiveTeam?.id;
    if (!id) return [];
    return readTasksWorkspaceCache(id)?.tags ?? [];
  });
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>(() => {
    const id = authActiveTeam?.id;
    if (!id) return [];
    return readTasksWorkspaceCache(id)?.templates ?? [];
  });
  const [myTasks, setMyTasks] = useState<TeamTask[]>(() => {
    const id = authActiveTeam?.id;
    if (!id) return [];
    return readTasksWorkspaceCache(id)?.myTasks ?? [];
  });
  const [completedToday, setCompletedToday] = useState(() => {
    const id = authActiveTeam?.id;
    if (!id) return 0;
    return readTasksWorkspaceCache(id)?.completedToday ?? 0;
  });
  const [projectBundles, setProjectBundles] = useState<Record<number, TaskProjectBundle>>({});

  useEffect(() => {
    setActiveTeam(authActiveTeam);
    setPermissions(authPermissions);
  }, [authActiveTeam, authPermissions]);

  useEffect(() => {
    if (authLoading || !user || !activeTeam?.id) return;
    void prefetchChatSession(activeTeam.id);
    void prefetchTeamMembers(activeTeam.id);
  }, [authLoading, user, activeTeam?.id]);

  useLayoutEffect(() => {
    if (!activeTeam?.id) {
      setMembers([]);
      setInvites([]);
      setJobTitlePresets([]);
      return;
    }
    const cachedMembers = readTeamMembersCache(activeTeam.id);
    if (cachedMembers) {
      setMembers(cachedMembers.members);
      setInvites(cachedMembers.invites);
      setJobTitlePresets(cachedMembers.jobTitlePresets);
    }
    const cachedTasks = readTasksWorkspaceCache(activeTeam.id);
    if (cachedTasks) {
      setTaskProjects(cachedTasks.projects);
      setTaskTags(cachedTasks.tags);
      setTaskTemplates(cachedTasks.templates);
      setMyTasks(cachedTasks.myTasks);
      setCompletedToday(cachedTasks.completedToday);
    }
  }, [activeTeam?.id]);

  const clearTasksWorkspace = useCallback(() => {
    setTaskProjects([]);
    setTaskTags([]);
    setTaskTemplates([]);
    setMyTasks([]);
    setCompletedToday(0);
    setProjectBundles({});
  }, []);

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
    writeTeamMembersCache(activeTeam.id, { members: m, invites: i, jobTitlePresets: p });
  }, [activeTeam]);

  const refreshTasksWorkspace = useCallback(async () => {
    if (!activeTeam) {
      clearTasksWorkspace();
      return;
    }
    try {
      const [projects, tags, templates, my] = await Promise.all([
        fetchTaskProjects(activeTeam.id),
        fetchTaskTags(activeTeam.id),
        fetchTaskTemplates(activeTeam.id),
        fetchMyTasks(activeTeam.id),
      ]);
      setTaskProjects(projects);
      setTaskTags(tags);
      setTaskTemplates(templates);
      setMyTasks(my.tasks);
      setCompletedToday(my.completedToday);
      writeTasksWorkspaceCache(activeTeam.id, {
        projects,
        tags,
        templates,
        myTasks: my.tasks,
        completedToday: my.completedToday,
      });
    } catch {
      /* keep prior workspace on failure */
    }
  }, [activeTeam, clearTasksWorkspace]);

  const refreshProjectBundle = useCallback(
    async (projectId: number) => {
      if (!activeTeam) return;
      const [tasks, sections, files] = await Promise.all([
        fetchProjectTasks(activeTeam.id, projectId),
        fetchProjectSections(activeTeam.id, projectId),
        fetchProjectFiles(activeTeam.id, projectId),
      ]);
      setProjectBundles((prev) => ({
        ...prev,
        [projectId]: { tasks, sections, files },
      }));
    },
    [activeTeam],
  );

  const updateProjectBundle = useCallback((projectId: number, patch: Partial<TaskProjectBundle>) => {
    setProjectBundles((prev) => {
      const current = prev[projectId] ?? emptyProjectBundle();
      return {
        ...prev,
        [projectId]: { ...current, ...patch },
      };
    });
  }, []);

  const purgeProjectBundle = useCallback((projectId: number) => {
    setProjectBundles((prev) => {
      if (!(projectId in prev)) return prev;
      const next = { ...prev };
      delete next[projectId];
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      setTeams([]);
      setActiveTeam(null);
      setPermissions(null);
      setMembers([]);
      setInvites([]);
      clearTasksWorkspace();
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
  }, [user, checkAuth, authActiveTeam, authPermissions, setAuthActiveTeam, setAuthPermissions, clearTasksWorkspace]);

  useEffect(() => {
    void refresh();
  }, [user?.id]);

  useEffect(() => {
    void refreshMembers();
  }, [refreshMembers]);

  useEffect(() => {
    if (!activeTeam?.id) {
      clearTasksWorkspace();
      return;
    }
    void refreshTasksWorkspace();
  }, [activeTeam?.id, clearTasksWorkspace, refreshTasksWorkspace]);

  const switchTeam = useCallback(
    async (teamId: number) => {
      const r = await switchTeamApi(teamId);
      if (!r.ok || !r.team) return false;
      setActiveTeam(r.team);
      setPermissions(r.team.permissions ?? null);
      setAuthActiveTeam(r.team);
      setAuthPermissions(r.team.permissions ?? null);
      await Promise.all([refreshMembers(), refreshTasksWorkspace()]);
      return true;
    },
    [refreshMembers, refreshTasksWorkspace, setAuthActiveTeam, setAuthPermissions],
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
      taskProjects,
      taskTags,
      taskTemplates,
      myTasks,
      completedToday,
      projectBundles,
      refresh,
      refreshMembers,
      refreshTasksWorkspace,
      refreshProjectBundle,
      setMyTasks,
      setTaskProjects,
      setTaskTags,
      setTaskTemplates,
      setCompletedToday,
      updateProjectBundle,
      purgeProjectBundle,
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
      taskProjects,
      taskTags,
      taskTemplates,
      myTasks,
      completedToday,
      projectBundles,
      refresh,
      refreshMembers,
      refreshTasksWorkspace,
      refreshProjectBundle,
      updateProjectBundle,
      purgeProjectBundle,
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
