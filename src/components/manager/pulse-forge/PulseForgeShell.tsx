import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTeam } from "@/contexts/TeamContext";
import { useActiveWordPressSite } from "@/contexts/active-wordpress-site-context";
import { useWordPressSites } from "@/hooks/use-wordpress-sites";
import { PulseForgeNavSidebar } from "@/components/manager/pulse-forge/PulseForgeNavSidebar";
import { AutomationRecipeLibrary } from "@/components/manager/tasks/recipes/AutomationRecipeLibrary";
import { AutomationPlannerDialog } from "@/components/manager/tasks/planner/AutomationPlannerDialog";
import { TasksListView } from "@/components/manager/tasks/TasksListView";
import {
  createTaskProject,
  deleteTaskProject,
  updateTask,
  updateTaskProject,
} from "@/lib/tasks-api";
import { isAutomationProject } from "@/lib/task-automation-templates";
import type { AutomationRecipeCatalogItem } from "@/lib/automation-recipes-types";
import type { DefaultTaskCreatePayload, TaskProject, TeamTask } from "@/lib/tasks-types";
import type { WordPressSiteOption } from "@/components/manager/tasks/NewProjectDialog";
import type { PulseForgeNavMode } from "@/components/manager/pulse-forge/PulseForgeNavSidebar";
import { isNeoPulseBotMember } from "@/lib/chat-neo-pulse";

export function PulseForgeShell(): React.ReactElement {
  const {
    activeTeam,
    members,
    taskProjects,
    taskTemplates,
    projectBundles,
    refreshTasksWorkspace,
    refreshProjectBundle,
    setTaskProjects,
    setTaskTemplates,
    updateProjectBundle,
    purgeProjectBundle,
  } = useTeam();
  const { sites: wpSites } = useWordPressSites();
  const { activeWordPressSiteId } = useActiveWordPressSite();
  const teamId = activeTeam?.id ?? null;

  const [navMode, setNavMode] = useState<PulseForgeNavMode>("recipes");
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [plannerMode, setPlannerMode] = useState<"recipe" | "create" | "edit">("create");
  const [plannerRecipe, setPlannerRecipe] = useState<AutomationRecipeCatalogItem | null>(null);
  const [editingAutomation, setEditingAutomation] = useState<TaskProject | null>(null);

  const siteOptions: WordPressSiteOption[] = useMemo(
    () => wpSites.map((s) => ({ id: s.id, name: s.name || s.siteUrl || s.id })),
    [wpSites],
  );

  const automationProjects = useMemo(
    () =>
      taskProjects.filter((p) =>
        isAutomationProject(p, projectBundles[p.id]?.tasks, members),
      ),
    [members, projectBundles, taskProjects],
  );

  const activeBundleTasks = activeProjectId != null ? projectBundles[activeProjectId]?.tasks ?? [] : [];
  const editingTasks =
    editingAutomation != null ? projectBundles[editingAutomation.id]?.tasks ?? [] : [];

  const openCreate = useCallback(() => {
    setPlannerMode("create");
    setPlannerRecipe(null);
    setEditingAutomation(null);
    setPlannerOpen(true);
  }, []);

  const openRecipe = useCallback((recipe: AutomationRecipeCatalogItem) => {
    setPlannerMode("recipe");
    setPlannerRecipe(recipe);
    setEditingAutomation(null);
    setPlannerOpen(true);
  }, []);

  const openEdit = useCallback((project: TaskProject) => {
    setPlannerMode("edit");
    setPlannerRecipe(null);
    setEditingAutomation(project);
    setPlannerOpen(true);
  }, []);

  const handleCreate = useCallback(
    async (payload: Parameters<typeof createTaskProject>[1]) => {
      if (!teamId) return false;
      const result = await createTaskProject(teamId, payload);
      if (result.ok && result.project) {
        setTaskProjects((prev) => [...prev, result.project!]);
        setNavMode("forge");
        setActiveProjectId(result.project.id);
        void refreshProjectBundle(result.project.id);
        return true;
      }
      return false;
    },
    [refreshProjectBundle, setTaskProjects, teamId],
  );

  const handleUpdate = useCallback(
    async (
      projectId: number,
      payload: { keyword: string; title: string; description?: string; wordpressSiteId?: string | null },
    ) => {
      if (!teamId) return false;
      const result = await updateTaskProject(teamId, projectId, payload);
      if (result.ok && result.project) {
        setTaskProjects((prev) => prev.map((p) => (p.id === projectId ? result.project! : p)));
        void refreshTasksWorkspace();
        void refreshProjectBundle(projectId);
        return true;
      }
      return false;
    },
    [refreshProjectBundle, refreshTasksWorkspace, setTaskProjects, teamId],
  );

  const handleUpdateTask = useCallback(
    async (taskId: number, payload: DefaultTaskCreatePayload) => {
      if (!teamId) return false;
      const pulse = members.find((m) => isNeoPulseBotMember(m));
      const result = await updateTask(teamId, taskId, {
        ...payload,
        assigneeIds: pulse?.userId != null ? [pulse.userId] : payload.assigneeIds,
      });
      if (result.ok && result.task && editingAutomation) {
        const currentTasks = projectBundles[editingAutomation.id]?.tasks ?? [];
        updateProjectBundle(editingAutomation.id, {
          tasks: currentTasks.map((t) => (t.id === taskId ? result.task! : t)),
        });
        void refreshTasksWorkspace();
        return true;
      }
      return false;
    },
    [editingAutomation, members, projectBundles, refreshTasksWorkspace, teamId, updateProjectBundle],
  );

  const handleDeleteProject = useCallback(
    async (projectId: number) => {
      if (!teamId) return;
      const result = await deleteTaskProject(teamId, projectId);
      if (result.ok) {
        setTaskProjects((prev) => prev.filter((p) => p.id !== projectId));
        purgeProjectBundle(projectId);
        if (activeProjectId === projectId) {
          setActiveProjectId(null);
          setNavMode("forge");
        }
        void refreshTasksWorkspace();
      }
    },
    [activeProjectId, purgeProjectBundle, refreshTasksWorkspace, setTaskProjects, teamId],
  );

  useEffect(() => {
    if (navMode === "forge" && activeProjectId == null && automationProjects[0]) {
      setActiveProjectId(automationProjects[0].id);
    }
  }, [activeProjectId, automationProjects, navMode]);

  if (!teamId || !activeTeam) {
    return (
      <div className="flex h-full items-center justify-center bg-black px-6">
        <p className="text-base text-muted-foreground">Select a team to open Pulse Forge.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden bg-black">
      <PulseForgeNavSidebar
          navMode={navMode}
          activeProjectId={activeProjectId}
          automationProjects={automationProjects}
          onSelectRecipes={() => {
            setNavMode("recipes");
            setActiveProjectId(null);
          }}
          onSelectAutomation={(id) => {
            setNavMode("forge");
            setActiveProjectId(id);
          }}
          onNewAutomation={openCreate}
          onEditAutomation={openEdit}
          onDeleteAutomation={(id) => void handleDeleteProject(id)}
        />
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {navMode === "recipes" ? (
            <AutomationRecipeLibrary
              teamId={teamId}
              sites={siteOptions}
              defaultSiteId={activeWordPressSiteId}
              onRecipeClick={openRecipe}
              onRecipeInstall={openRecipe}
              onInstalled={(projectId) => {
                setNavMode("forge");
                setActiveProjectId(projectId);
              }}
            />
          ) : activeProjectId != null ? (
            <TasksListView
              sections={[]}
              tasks={activeBundleTasks}
              tags={[]}
              filterMode="all"
              selectedTaskId={null}
              memberNames={{}}
              members={members}
              siteOptions={siteOptions}
              myTasksMode={false}
              automationMode
              scheduleColumnLabel="Trigger"
              showExecuteAction
              canExecuteTask={() => true}
              automationProjectForTask={() =>
                automationProjects.find((p) => p.id === activeProjectId) ?? null
              }
              teamId={teamId}
              onSelectTask={() => {}}
              onStatusChange={() => {}}
              onAddTask={() => {}}
              onMoveTask={() => {}}
              onEditSection={() => {}}
              onDeleteSection={() => {}}
              onEditTask={() => {
                const project = automationProjects.find((p) => p.id === activeProjectId);
                if (project) openEdit(project);
              }}
              onDeleteTask={(taskId) => {
                const task = activeBundleTasks.find((t: TeamTask) => t.id === taskId);
                if (task) void handleDeleteProject(task.projectId);
              }}
              onExecuteTask={() => void refreshProjectBundle(activeProjectId)}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6">
              <p className="text-base text-muted-foreground">No automations installed yet.</p>
              <button
                type="button"
                className="text-base text-muted-foreground hover:text-white hover:underline"
                onClick={() => setNavMode("recipes")}
              >
                Browse recipes
              </button>
            </div>
          )}
        </main>

      <AutomationPlannerDialog
        open={plannerOpen}
        onOpenChange={setPlannerOpen}
        mode={plannerMode}
        teamId={teamId}
        sites={siteOptions}
        members={members}
        defaultSiteId={activeWordPressSiteId}
        recipe={plannerRecipe}
        editAutomation={editingAutomation}
        editAutomationTasks={editingTasks}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onUpdateTask={handleUpdateTask}
        onTemplatesChange={setTaskTemplates}
        onTaskExecuted={() => {
          if (editingAutomation) void refreshProjectBundle(editingAutomation.id);
        }}
        onInstalled={(projectId) => {
          setNavMode("forge");
          setActiveProjectId(projectId);
        }}
      />
    </div>
  );
}
