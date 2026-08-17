import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTeam } from "@/contexts/TeamContext";
import { useAgentRunsContext } from "@/contexts/agent-runs-context";
import { useActiveWordPressSite } from "@/contexts/active-wordpress-site-context";
import { useWordPressSites } from "@/hooks/use-wordpress-sites";
import { PulseForgeNavSidebar } from "@/components/manager/pulse-forge/PulseForgeNavSidebar";
import { PulseForgeDashboard } from "@/components/manager/pulse-forge/PulseForgeDashboard";
import { PulseForgeBreadcrumbs } from "@/components/manager/pulse-forge/PulseForgeBreadcrumbs";
import { AutomationRecipeLibrary } from "@/components/manager/tasks/recipes/AutomationRecipeLibrary";
import { TaskBuilderView } from "@/components/manager/pulse-forge/TaskBuilderView";
import { WorkflowEditorView } from "@/components/manager/workflow/WorkflowEditorView";
import { WorkflowList } from "@/components/manager/workflow/WorkflowList";
import { createTaskProject } from "@/lib/tasks-api";
import { fetchAutomationRecipe } from "@/lib/automation-recipes-api";
import { fetchWorkflow, createWorkflow } from "@/lib/workflow/workflow-api";
import { automationPlanToWorkflowGraph } from "@/lib/workflow/workflow-migrate-from-planner";
import { recipeToPlan } from "@/lib/automation-planner-compile";
import { isAutomationProject } from "@/lib/task-automation-templates";
import type { AutomationRecipeCatalogItem } from "@/lib/automation-recipes-types";
import type { TaskProject } from "@/lib/tasks-types";
import type { WordPressSiteOption } from "@/components/manager/tasks/NewProjectDialog";
import type { PulseForgeNavMode } from "@/components/manager/pulse-forge/PulseForgeNavSidebar";
import {
  pulseForgeNavModeFromRoute,
  setPulseForgeHash,
  usePulseForgeRoute,
  type PulseForgeRoute,
} from "@/lib/pulse-forge/pulse-forge-hash";
import { useAuth } from "@/contexts/AuthContext";
import { filterVisibleAutomationProjects } from "@/lib/pulse-forge/forge-automation-visibility";

export function PulseForgeShell(): React.ReactElement {
  const {
    activeTeam,
    members,
    taskProjects,
    projectBundles,
    refreshTasksWorkspace,
    refreshProjectBundle,
    setTaskProjects,
    setTaskTemplates,
  } = useTeam();
  const { user } = useAuth();
  const { runs, refreshRuns } = useAgentRunsContext();
  const { sites: wpSites } = useWordPressSites();
  const { activeWordPressSiteId } = useActiveWordPressSite();
  const teamId = activeTeam?.id ?? null;
  const route = usePulseForgeRoute();
  const navMode = pulseForgeNavModeFromRoute(route);

  const [recipeForRoute, setRecipeForRoute] = useState<AutomationRecipeCatalogItem | null>(null);
  const [workflowName, setWorkflowName] = useState<string | null>(null);
  const [draftWorkflowName, setDraftWorkflowName] = useState<string>("Untitled workflow");
  const [workflowSaveError, setWorkflowSaveError] = useState<string | null>(null);
  const [workflowListError, setWorkflowListError] = useState<string | null>(null);

  const siteOptions: WordPressSiteOption[] = useMemo(
    () => wpSites.map((s) => ({ id: s.id, name: s.name || s.siteUrl || s.id })),
    [wpSites],
  );

  const automationProjects = useMemo(() => {
    const automations = taskProjects.filter((p) =>
      isAutomationProject(p, projectBundles[p.id]?.tasks, members),
    );
    return filterVisibleAutomationProjects(automations, user?.id ?? null);
  }, [members, projectBundles, taskProjects, user?.id]);

  const workflowEditorOpen = useMemo(() => {
    if (route.section === "recipes" && "view" in route && route.view === "builder") return true;
    if (route.section === "workflows" && "view" in route) return true;
    return false;
  }, [route]);

  useEffect(() => {
    if (route.section !== "workflows") {
      setWorkflowSaveError(null);
      setWorkflowListError(null);
      return;
    }
    if ("view" in route) {
      setWorkflowListError(null);
      return;
    }
    setWorkflowSaveError(null);
  }, [route]);

  useEffect(() => {
    if (route.section !== "recipes" || !("view" in route) || route.view !== "builder") {
      setRecipeForRoute(null);
      return;
    }
    if (!teamId) {
      setRecipeForRoute(null);
      return;
    }
    let cancelled = false;
    void fetchAutomationRecipe(teamId, route.recipeKeyword).then((recipe) => {
      if (cancelled) return;
      setRecipeForRoute(recipe);
    });
    return () => {
      cancelled = true;
    };
  }, [route, teamId]);

  useEffect(() => {
    if (route.section !== "workflows" || !("view" in route) || route.view !== "edit" || !teamId) {
      setWorkflowName(null);
      return;
    }
    let cancelled = false;
    void fetchWorkflow(teamId, route.workflowId).then((workflow) => {
      if (!cancelled) setWorkflowName(workflow?.name ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [route, teamId]);

  const navigate = useCallback((next: PulseForgeRoute) => {
    setPulseForgeHash(next);
  }, []);

  const navigateSection = useCallback(
    (section: PulseForgeNavMode) => {
      navigate({ section });
    },
    [navigate],
  );

  const openRecipe = useCallback(
    (recipe: AutomationRecipeCatalogItem) => {
      navigate({ section: "recipes", view: "builder", recipeKeyword: recipe.keyword });
    },
    [navigate],
  );

  const openWorkflow = useCallback(
    (workflowId: number) => {
      navigate({ section: "workflows", view: "edit", workflowId });
    },
    [navigate],
  );

  const openCreateWorkflow = useCallback(() => {
    navigate({ section: "workflows", view: "new" });
  }, [navigate]);

  const closeEditor = useCallback(() => {
    if (route.section === "recipes") {
      navigate({ section: "recipes" });
      return;
    }
    navigate({ section: "workflows" });
  }, [navigate, route.section]);

  const handleCreateFromRecipe = useCallback(
    async (payload: Parameters<typeof createTaskProject>[1]) => {
      if (!teamId) return false;
      const result = await createTaskProject(teamId, payload);
      if (result.ok && result.project) {
        setTaskProjects((prev) => [...prev, result.project!]);
        void refreshProjectBundle(result.project.id);
        return true;
      }
      return false;
    },
    [refreshProjectBundle, setTaskProjects, teamId],
  );

  const handleRecipeInstallAsWorkflow = useCallback(
    async (recipe: AutomationRecipeCatalogItem) => {
      if (!teamId) return;
      const plan = recipeToPlan(recipe);
      const graph = automationPlanToWorkflowGraph(plan, {
        teamId,
        siteId: activeWordPressSiteId,
      });
      const created = await createWorkflow(teamId, graph);
      if (created.workflow) {
        openWorkflow(created.workflow.id);
      }
    },
    [activeWordPressSiteId, openWorkflow, teamId],
  );

  if (!teamId || !activeTeam) {
    return (
      <div className="flex h-full items-center justify-center bg-black px-6">
        <p className="text-base text-muted-foreground">Select a team to open Pulse Forge.</p>
      </div>
    );
  }

  return (
    <div className="neo-pulse-forge-shell flex h-full min-h-0 w-full flex-1 overflow-hidden bg-black font-sans">
      <PulseForgeNavSidebar
        navMode={navMode}
        workflowEditorOpen={workflowEditorOpen}
        onSelectMyForge={() => navigateSection("forge")}
        onSelectRecipes={() => navigateSection("recipes")}
        onSelectWorkflows={() => {
          navigateSection("workflows");
          void refreshRuns();
        }}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {route.section === "workflows" ? null : (
          <div className="shrink-0 border-b border-white/10 bg-black">
            <PulseForgeBreadcrumbs
              route={route}
              recipeName={recipeForRoute?.name}
              workflowName={
                route.section === "workflows" && "view" in route && route.view === "new"
                  ? draftWorkflowName
                  : workflowName
              }
              statusMessage={
                route.section === "workflows"
                  ? "view" in route
                    ? workflowSaveError
                    : workflowListError
                  : null
              }
              className="px-4 py-3"
            />
          </div>
        )}
        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {route.section === "recipes" && "view" in route && route.view === "builder" ? (
            recipeForRoute ? (
              <TaskBuilderView
                mode="recipe"
                teamId={teamId}
                sites={siteOptions}
                members={members}
                defaultSiteId={activeWordPressSiteId}
                recipe={recipeForRoute}
                onCancel={closeEditor}
                onCreate={handleCreateFromRecipe}
                onTemplatesChange={setTaskTemplates}
              />
            ) : (
              <div className="flex h-full items-center justify-center px-6">
                <p className="text-base text-muted-foreground">Agent not found.</p>
              </div>
            )
          ) : route.section === "workflows" && "view" in route && route.view === "edit" ? (
            <WorkflowEditorView
              teamId={teamId}
              workflowId={route.workflowId}
              sites={siteOptions}
              defaultSiteId={activeWordPressSiteId}
              route={route}
              statusMessage={workflowSaveError}
              onCreated={(workflowId) => openWorkflow(workflowId)}
              onCancel={closeEditor}
              onNameChange={setWorkflowName}
              onSaveErrorChange={setWorkflowSaveError}
            />
          ) : route.section === "workflows" && "view" in route && route.view === "new" ? (
            <WorkflowEditorView
              teamId={teamId}
              workflowId={null}
              sites={siteOptions}
              defaultSiteId={activeWordPressSiteId}
              route={route}
              statusMessage={workflowSaveError}
              onCreated={(workflowId) => openWorkflow(workflowId)}
              onCancel={closeEditor}
              onNameChange={setDraftWorkflowName}
              onSaveErrorChange={setWorkflowSaveError}
            />
          ) : navMode === "recipes" ? (
            <AutomationRecipeLibrary
              teamId={teamId}
              sites={siteOptions}
              defaultSiteId={activeWordPressSiteId}
              onRecipeClick={openRecipe}
              onRecipeInstall={(recipe) => void handleRecipeInstallAsWorkflow(recipe)}
              onInstalled={() => navigate({ section: "workflows" })}
            />
          ) : navMode === "workflows" ? (
            <WorkflowList
              teamId={teamId}
              sites={siteOptions}
              route={route}
              statusMessage={workflowListError}
              onOpenWorkflow={openWorkflow}
              onNewWorkflow={openCreateWorkflow}
              onLoadErrorChange={setWorkflowListError}
            />
          ) : (
            <PulseForgeDashboard
              automationProjects={automationProjects}
              projectBundles={projectBundles}
              onEditAutomation={(project: TaskProject) => openCreateWorkflow()}
              onRefreshProject={(projectId) => void refreshProjectBundle(projectId)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
