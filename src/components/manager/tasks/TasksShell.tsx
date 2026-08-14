import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTeam } from "@/contexts/TeamContext";
import { usePulseAssistContext } from "@/contexts/pulse-assist-context";
import { useAgentRunsContext } from "@/contexts/agent-runs-context";
import { taskCanExecuteWithAgent } from "@/lib/agent-runs-types";
import { TasksNavSidebar } from "@/components/manager/tasks/TasksNavSidebar";
import { TasksContextHeader } from "@/components/manager/tasks/TasksContextHeader";
import { TasksFilterToolbar } from "@/components/manager/tasks/TasksFilterToolbar";
import { TasksListView } from "@/components/manager/tasks/TasksListView";
import { TasksBoardView } from "@/components/manager/tasks/TasksBoardView";
import { TasksCalendarView } from "@/components/manager/tasks/TasksCalendarView";
import { TasksFilesView } from "@/components/manager/tasks/TasksFilesView";
import { TaskDetailPane } from "@/components/manager/tasks/TaskDetailPane";
import { NewProjectDialog } from "@/components/manager/tasks/NewProjectDialog";
import { TemplateManagerDialog } from "@/components/manager/tasks/TemplateManagerDialog";
import { NewTaskDialog, type TaskFormPayload } from "@/components/manager/tasks/NewTaskDialog";
import { AddSectionDialog } from "@/components/manager/tasks/AddSectionDialog";
import { useWordPressSites } from "@/hooks/use-wordpress-sites";
import { useActiveWordPressSite } from "@/contexts/active-wordpress-site-context";
import {
  addTaskNote,
  createProjectSection,
  createProjectTask,
  createSubtask,
  createTaskProject,
  deleteProjectSection,
  deleteTask,
  deleteTaskProject,
  fetchMyTasks,
  fetchProjectFiles,
  fetchProjectSections,
  fetchProjectTasks,
  fetchTaskDetail,
  fetchTaskProjects,
  fetchTaskTags,
  fetchTaskTemplates,
  saveTemplateFromProject,
  updateProjectSection,
  updateTask,
  updateTaskProject,
  uploadTaskFile,
} from "@/lib/tasks-api";
import { filterTasks, filterTasksByQuery, sortTasks } from "@/lib/tasks-filter";
import type {
  TaskFile,
  TaskNote,
  TaskProject,
  TaskSection,
  TaskTag,
  TaskTemplate,
  TeamTask,
  TaskStatus,
  TasksFilterMode,
  TasksNavMode,
  TasksSortMode,
  TasksViewMode,
} from "@/lib/tasks-types";

export function TasksShell(): React.ReactElement {
  const { user } = useAuth();
  const { activeTeam, members } = useTeam();
  const { setTasksBridge } = usePulseAssistContext();
  const { startRunFromTask } = useAgentRunsContext();
  const { sites: wpSites } = useWordPressSites();
  const { activeWordPressSiteId } = useActiveWordPressSite();
  const teamId = activeTeam?.id ?? null;
  const userId = user?.id ?? 0;

  const [navMode, setNavMode] = useState<TasksNavMode>("my");
  const [viewMode, setViewMode] = useState<TasksViewMode>("list");
  const [filterMode, setFilterMode] = useState<TasksFilterMode>("incomplete");
  const [sortMode, setSortMode] = useState<TasksSortMode>("dueDate");
  const [searchQuery, setSearchQuery] = useState("");
  const [projects, setProjects] = useState<TaskProject[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [tags, setTags] = useState<TaskTag[]>([]);
  const [sections, setSections] = useState<TaskSection[]>([]);
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [projectFiles, setProjectFiles] = useState<TaskFile[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedNotes, setSelectedNotes] = useState<TaskNote[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<TaskFile[]>([]);
  const [selectedSubtasks, setSelectedSubtasks] = useState<TeamTask[]>([]);
  const [completedToday, setCompletedToday] = useState(0);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [creatingSection, setCreatingSection] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [editingProject, setEditingProject] = useState<TaskProject | null>(null);
  const [editingSection, setEditingSection] = useState<TaskSection | null>(null);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);

  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<Record<string, unknown>>({});

  const humanMembers = useMemo(() => members.filter((m) => !m.isBot), [members]);

  const siteOptions = useMemo(
    () =>
      wpSites
        .filter((s) => s.enabled !== false)
        .map((s) => ({ id: s.id, name: s.name.trim() || s.siteUrl })),
    [wpSites],
  );

  const memberNames = useMemo(() => {
    const map = new Map<number, string>();
    for (const m of members) {
      map.set(m.userId, m.displayName || m.email);
    }
    return map;
  }, [members]);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );

  useEffect(() => {
    setTasksBridge({
      activeProjectId,
      activeProjectTitle: activeProject?.title?.trim() || null,
    });
  }, [activeProject?.title, activeProjectId, setTasksBridge]);

  const contextTitle = navMode === "my" ? "My Tasks" : (activeProject?.title ?? "Project");

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );

  const displayTasks = useMemo(() => {
    let list = filterTasks(tasks, filterMode);
    list = filterTasksByQuery(list, searchQuery);
    list = sortTasks(list, sortMode);
    return list;
  }, [tasks, filterMode, searchQuery, sortMode]);

  const refreshProjects = useCallback(async () => {
    if (!teamId) return;
    setLoadingProjects(true);
    try {
      const [list, tagList, tpl] = await Promise.all([
        fetchTaskProjects(teamId),
        fetchTaskTags(teamId),
        fetchTaskTemplates(teamId),
      ]);
      setProjects(list);
      setTags(tagList);
      setTemplates(tpl);
    } finally {
      setLoadingProjects(false);
    }
  }, [teamId]);

  const refreshMyTasks = useCallback(async () => {
    if (!teamId) return;
    setLoadingTasks(true);
    try {
      const { tasks: list, completedToday: count } = await fetchMyTasks(teamId);
      setTasks(list);
      setCompletedToday(count);
      setSections([]);
    } finally {
      setLoadingTasks(false);
    }
  }, [teamId]);

  const refreshProjectData = useCallback(async () => {
    if (!teamId || activeProjectId == null) {
      setTasks([]);
      setSections([]);
      setProjectFiles([]);
      return;
    }
    setLoadingTasks(true);
    try {
      const [taskList, sectionList, files] = await Promise.all([
        fetchProjectTasks(teamId, activeProjectId),
        fetchProjectSections(teamId, activeProjectId),
        fetchProjectFiles(teamId, activeProjectId),
      ]);
      setTasks(taskList);
      setSections(sectionList);
      setProjectFiles(files);
      if (selectedTaskId != null && !taskList.some((t) => t.id === selectedTaskId)) {
        setSelectedTaskId(null);
      }
    } finally {
      setLoadingTasks(false);
    }
  }, [activeProjectId, selectedTaskId, teamId]);

  const refreshTaskDetail = useCallback(async () => {
    if (!teamId || selectedTaskId == null) {
      setSelectedNotes([]);
      setSelectedFiles([]);
      setSelectedSubtasks([]);
      return;
    }
    const detail = await fetchTaskDetail(teamId, selectedTaskId);
    if (detail.task) {
      setTasks((prev) => prev.map((t) => (t.id === detail.task!.id ? detail.task! : t)));
      setSelectedNotes(detail.notes);
      setSelectedFiles(detail.files);
      setSelectedSubtasks(detail.subtasks);
    }
  }, [selectedTaskId, teamId]);

  useEffect(() => {
    if (!teamId) {
      setProjects([]);
      setTasks([]);
      return;
    }
    void refreshProjects();
  }, [teamId, refreshProjects]);

  useEffect(() => {
    if (navMode === "my") {
      void refreshMyTasks();
    } else {
      void refreshProjectData();
    }
  }, [navMode, refreshMyTasks, refreshProjectData]);

  useEffect(() => {
    void refreshTaskDetail();
  }, [refreshTaskDetail]);

  const flushTaskPatch = useCallback(async () => {
    if (!teamId || selectedTaskId == null) return;
    const patch = pendingPatchRef.current;
    if (Object.keys(patch).length === 0) return;
    pendingPatchRef.current = {};
    setSaving(true);
    try {
      const result = await updateTask(teamId, selectedTaskId, patch as Parameters<typeof updateTask>[2]);
      if (result.ok && result.task) {
        setTasks((prev) => prev.map((t) => (t.id === result.task!.id ? result.task! : t)));
      }
    } finally {
      setSaving(false);
    }
  }, [selectedTaskId, teamId]);

  const queueTaskPatch = useCallback(
    (patch: Parameters<typeof updateTask>[2]) => {
      pendingPatchRef.current = { ...pendingPatchRef.current, ...patch };
      if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
      updateTimerRef.current = setTimeout(() => void flushTaskPatch(), 400);
    },
    [flushTaskPatch],
  );

  const handleStatusChange = useCallback(
    async (taskId: number, status: TaskStatus) => {
      if (!teamId) return;
      const result = await updateTask(teamId, taskId, { status });
      if (result.ok && result.task) {
        setTasks((prev) => prev.map((t) => (t.id === result.task!.id ? result.task! : t)));
        if (navMode === "my") void refreshMyTasks();
      }
    },
    [navMode, refreshMyTasks, teamId],
  );

  const handleCreateProject = useCallback(
    async (payload: Parameters<typeof createTaskProject>[1]) => {
      if (!teamId) return false;
      const result = await createTaskProject(teamId, payload);
      if (result.ok && result.project) {
        setProjects((prev) => [...prev, result.project!]);
        setNavMode("project");
        setActiveProjectId(result.project.id);
        return true;
      }
      return false;
    },
    [teamId],
  );

  const handleUpdateProject = useCallback(
    async (projectId: number, payload: { keyword: string; title: string; description?: string }) => {
      if (!teamId) return false;
      const result = await updateTaskProject(teamId, projectId, payload);
      if (result.ok && result.project) {
        setProjects((prev) => prev.map((p) => (p.id === projectId ? result.project! : p)));
        return true;
      }
      return false;
    },
    [teamId],
  );

  const handleSaveTemplate = useCallback(async () => {
    if (!teamId || activeProjectId == null || !activeProject?.title?.trim()) return;
    setSavingTemplate(true);
    try {
      const result = await saveTemplateFromProject(teamId, {
        projectId: activeProjectId,
        name: activeProject.title.trim(),
        keyword: activeProject.keyword?.trim() || undefined,
      });
      if (result.ok && result.templates) {
        setTemplates(result.templates);
      }
    } finally {
      setSavingTemplate(false);
    }
  }, [activeProject?.keyword, activeProject?.title, activeProjectId, teamId]);

  const handleDeleteProject = useCallback(
    async (projectId: number) => {
      if (!teamId) return;
      const result = await deleteTaskProject(teamId, projectId);
      if (result.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
        if (activeProjectId === projectId) {
          setNavMode("my");
          setActiveProjectId(null);
          setSelectedTaskId(null);
          setTasks([]);
          setSections([]);
        }
      }
    },
    [activeProjectId, teamId],
  );

  const handleCreateTask = useCallback(
    async (payload: TaskFormPayload & { projectId: number }) => {
      if (!teamId || payload.projectId <= 0) return false;

      let sectionId = 0;
      if (activeProjectId === payload.projectId && sections.length > 0) {
        sectionId = sections[0]!.id;
      } else {
        const sectionList = await fetchProjectSections(teamId, payload.projectId);
        sectionId = sectionList[0]?.id ?? 0;
      }

      const assigneeIds =
        payload.assigneeIds && payload.assigneeIds.length > 0
          ? payload.assigneeIds
          : userId > 0
            ? [userId]
            : [];

      const result = await createProjectTask(teamId, payload.projectId, {
        keyword: payload.keyword,
        title: payload.title,
        description: payload.description,
        status: payload.status,
        dueDate: payload.dueDate,
        recurrenceRule: payload.recurrenceRule,
        assigneeIds,
        wordpressSiteId: payload.wordpressSiteId,
        tagIds: payload.tagIds,
        sectionId,
      });
      if (result.ok && result.task) {
        if (navMode === "my") {
          void refreshMyTasks();
        } else if (activeProjectId === payload.projectId) {
          setTasks((prev) => [...prev, result.task!]);
        } else {
          void refreshProjectData();
        }
        setSelectedTaskId(result.task.id);
        return true;
      }
      return false;
    },
    [activeProjectId, navMode, refreshMyTasks, refreshProjectData, sections, teamId, userId],
  );

  const handleInlineAddTask = useCallback(
    async (sectionId: number, title: string) => {
      if (!teamId || activeProjectId == null) return;
      const keyword = title.toLowerCase().replace(/\s+/g, "-");
      const result = await createProjectTask(teamId, activeProjectId, {
        keyword,
        title,
        sectionId,
        assigneeIds: userId > 0 ? [userId] : [],
      });
      if (result.ok && result.task) {
        setTasks((prev) => [...prev, result.task!]);
      }
    },
    [activeProjectId, teamId, userId],
  );

  const handleMoveTask = useCallback(
    async (taskId: number, sectionId: number) => {
      if (!teamId) return;
      const result = await updateTask(teamId, taskId, { sectionId });
      if (result.ok && result.task) {
        setTasks((prev) => prev.map((t) => (t.id === result.task!.id ? result.task! : t)));
      }
    },
    [teamId],
  );

  const handleCreateSection = useCallback(
    async (payload: { keyword: string; title: string }) => {
      if (!teamId || activeProjectId == null) return false;
      setCreatingSection(true);
      try {
        const result = await createProjectSection(teamId, activeProjectId, {
          keyword: payload.keyword,
          title: payload.title,
          sortOrder: sections.length,
        });
        if (result.ok && result.section) {
          setSections((prev) => [...prev, result.section!]);
          return true;
        }
        return false;
      } finally {
        setCreatingSection(false);
      }
    },
    [activeProjectId, sections.length, teamId],
  );

  const handleUpdateSection = useCallback(
    async (sectionId: number, payload: { keyword: string; title: string }) => {
      if (!teamId || activeProjectId == null) return false;
      const result = await updateProjectSection(teamId, activeProjectId, sectionId, payload);
      if (result.ok && result.section) {
        setSections((prev) => prev.map((s) => (s.id === sectionId ? result.section! : s)));
        return true;
      }
      return false;
    },
    [activeProjectId, teamId],
  );

  const handleDeleteSection = useCallback(
    async (sectionId: number) => {
      if (!teamId || activeProjectId == null) return;
      const deletedTaskIds = new Set(
        tasks.filter((t) => t.sectionId === sectionId).map((t) => t.id),
      );
      const result = await deleteProjectSection(teamId, activeProjectId, sectionId);
      if (result.ok) {
        setSections((prev) => prev.filter((s) => s.id !== sectionId));
        setTasks((prev) => prev.filter((t) => t.sectionId !== sectionId));
        if (selectedTaskId != null && deletedTaskIds.has(selectedTaskId)) {
          setSelectedTaskId(null);
        }
      }
    },
    [activeProjectId, selectedTaskId, tasks, teamId],
  );

  const handleAddNote = useCallback(
    async (body: string, mentionUserIds: number[]) => {
      if (!teamId || selectedTaskId == null) return;
      const result = await addTaskNote(teamId, selectedTaskId, body, mentionUserIds);
      if (result.ok && result.note) {
        setSelectedNotes((prev) => [...prev, result.note!]);
      }
    },
    [selectedTaskId, teamId],
  );

  const handleUploadFile = useCallback(
    async (file: File) => {
      if (!teamId || selectedTaskId == null) return;
      setUploading(true);
      try {
        const result = await uploadTaskFile(teamId, selectedTaskId, file);
        if (result.ok && result.file) {
          setSelectedFiles((prev) => [...prev, result.file!]);
          if (navMode === "project") void refreshProjectData();
        }
      } finally {
        setUploading(false);
      }
    },
    [navMode, refreshProjectData, selectedTaskId, teamId],
  );

  const handleAddSubtask = useCallback(
    async (title: string) => {
      if (!teamId || selectedTaskId == null) return;
      const result = await createSubtask(teamId, selectedTaskId, {
        title,
        keyword: title.toLowerCase().replace(/\s+/g, "-"),
      });
      if (result.ok && result.task) {
        setSelectedSubtasks((prev) => [...prev, result.task!]);
      }
    },
    [selectedTaskId, teamId],
  );

  const handleUpdateTask = useCallback(
    async (taskId: number, payload: TaskFormPayload) => {
      if (!teamId) return false;
      const result = await updateTask(teamId, taskId, payload);
      if (result.ok && result.task) {
        setTasks((prev) => prev.map((t) => (t.id === taskId ? result.task! : t)));
        return true;
      }
      return false;
    },
    [teamId],
  );

  const handleDeleteTaskById = useCallback(
    async (taskId: number) => {
      if (!teamId) return;
      const result = await deleteTask(teamId, taskId);
      if (result.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== taskId));
        if (selectedTaskId === taskId) {
          setSelectedTaskId(null);
        }
      }
    },
    [selectedTaskId, teamId],
  );

  const handleDeleteTask = useCallback(async () => {
    if (selectedTaskId == null) return;
    await handleDeleteTaskById(selectedTaskId);
  }, [handleDeleteTaskById, selectedTaskId]);

  if (!teamId || !activeTeam) {
    return (
      <div className="flex h-full items-center justify-center bg-black px-6">
        <p className="text-base text-muted-foreground">Select a team to view tasks.</p>
      </div>
    );
  }

  const mainView = (() => {
    if (loadingTasks) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-base text-muted-foreground">Loading tasks…</p>
        </div>
      );
    }
    if (viewMode === "board") {
      return (
        <TasksBoardView
          tasks={displayTasks}
          selectedTaskId={selectedTaskId}
          memberNames={memberNames}
          onSelectTask={setSelectedTaskId}
          onStatusChange={(id, status) => void handleStatusChange(id, status)}
        />
      );
    }
    if (viewMode === "calendar") {
      return (
        <TasksCalendarView
          tasks={displayTasks}
          selectedTaskId={selectedTaskId}
          onSelectTask={setSelectedTaskId}
        />
      );
    }
    if (viewMode === "files") {
      return (
        <TasksFilesView teamId={teamId} files={projectFiles} onSelectTask={setSelectedTaskId} />
      );
    }
    return (
      <TasksListView
        sections={sections}
        tasks={displayTasks}
        tags={tags}
        filterMode={filterMode}
        selectedTaskId={selectedTaskId}
        memberNames={memberNames}
        siteOptions={siteOptions}
        myTasksMode={navMode === "my"}
        onSelectTask={setSelectedTaskId}
        onStatusChange={(id, status) => void handleStatusChange(id, status)}
        onAddTask={(sectionId, title) => void handleInlineAddTask(sectionId, title)}
        onMoveTask={(taskId, sectionId) => void handleMoveTask(taskId, sectionId)}
        onEditSection={(sectionId) => {
          const section = sections.find((s) => s.id === sectionId) ?? null;
          setEditingSection(section);
          setSectionDialogOpen(true);
        }}
        onDeleteSection={(sectionId) => void handleDeleteSection(sectionId)}
        onEditTask={(taskId) => {
          const task = tasks.find((t) => t.id === taskId) ?? null;
          setEditingTask(task);
          setTaskDialogOpen(true);
        }}
        onDeleteTask={(taskId) => void handleDeleteTaskById(taskId)}
      />
    );
  })();

  return (
    <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden bg-black">
      <TasksNavSidebar
        navMode={navMode}
        activeProjectId={activeProjectId}
        projects={projects}
        loading={loadingProjects}
        onSelectMyTasks={() => {
          setNavMode("my");
          setSelectedTaskId(null);
        }}
        onSelectProject={(id) => {
          setNavMode("project");
          setActiveProjectId(id);
          setSelectedTaskId(null);
        }}
        onNewProject={() => {
          setEditingProject(null);
          setProjectDialogOpen(true);
        }}
        onOpenTemplates={() => setTemplateDialogOpen(true)}
        onEditProject={(project) => {
          setEditingProject(project);
          setProjectDialogOpen(true);
        }}
        onDeleteProject={(projectId) => void handleDeleteProject(projectId)}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <TasksContextHeader
          contextTitle={contextTitle}
          viewMode={viewMode}
          completedToday={completedToday}
          onViewModeChange={setViewMode}
        />
        <TasksFilterToolbar
          searchQuery={searchQuery}
          filterMode={filterMode}
          sortMode={sortMode}
          addTaskDisabled={projects.length === 0}
          onSearchChange={setSearchQuery}
          onFilterChange={setFilterMode}
          onSortChange={setSortMode}
          onAddTask={() => {
            setEditingTask(null);
            setTaskDialogOpen(true);
          }}
          onAddSection={() => {
            setEditingSection(null);
            setSectionDialogOpen(true);
          }}
          showAddSection={navMode === "project" && viewMode === "list" && !sectionDialogOpen && !creatingSection}
          showSaveTemplate={navMode === "project" && activeProjectId != null}
          saveTemplateDisabled={savingTemplate || tasks.length === 0}
          onSaveTemplate={() => void handleSaveTemplate()}
        />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {mainView}
          {selectedTask ? (
            <TaskDetailPane
              task={selectedTask}
              notes={selectedNotes}
              files={selectedFiles}
              subtasks={selectedSubtasks}
              tags={tags}
              members={members}
              mentionMembers={humanMembers}
              siteOptions={siteOptions}
              memberNames={memberNames}
              teamId={teamId}
              saving={saving}
              uploading={uploading}
              onClose={() => setSelectedTaskId(null)}
              onMarkDone={() => void handleStatusChange(selectedTask.id, "done")}
              onUpdate={queueTaskPatch}
              onAddNote={(body, ids) => void handleAddNote(body, ids)}
              onUploadFile={(file) => void handleUploadFile(file)}
              onAddSubtask={(title) => void handleAddSubtask(title)}
              onToggleSubtask={(id, status) => void handleStatusChange(id, status)}
              onDelete={() => void handleDeleteTask()}
              onExecuteWithAgent={
                selectedTask.executionKind
                  ? () => {
                      if (!taskCanExecuteWithAgent(selectedTask)) return;
                      void startRunFromTask(selectedTask);
                    }
                  : undefined
              }
              executeWithAgentDisabledReason={
                selectedTask.executionKind && !taskCanExecuteWithAgent(selectedTask)
                  ? "Add executionPayload.targetUrl on the task to run with an agent."
                  : null
              }
            />
          ) : null}
        </div>
      </div>
      <NewProjectDialog
        open={projectDialogOpen}
        onOpenChange={(open) => {
          setProjectDialogOpen(open);
          if (!open) setEditingProject(null);
        }}
        templates={templates}
        sites={siteOptions}
        defaultSiteId={activeWordPressSiteId}
        editProject={editingProject}
        onCreate={handleCreateProject}
        onUpdate={handleUpdateProject}
      />
      <TemplateManagerDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        teamId={teamId}
        templates={templates}
        activeProjectId={navMode === "project" ? activeProjectId : null}
        activeProjectTitle={activeProject?.title ?? null}
        onTemplatesChange={setTemplates}
      />
      <NewTaskDialog
        open={taskDialogOpen}
        onOpenChange={(open) => {
          setTaskDialogOpen(open);
          if (!open) setEditingTask(null);
        }}
        projects={projects}
        defaultProjectId={navMode === "project" ? activeProjectId : null}
        editTask={editingTask}
        members={members}
        siteOptions={siteOptions}
        tags={tags}
        defaultClientId={activeWordPressSiteId}
        onCreate={handleCreateTask}
        onUpdate={handleUpdateTask}
      />
      <AddSectionDialog
        open={sectionDialogOpen}
        onOpenChange={(open) => {
          setSectionDialogOpen(open);
          if (!open) setEditingSection(null);
        }}
        editSection={editingSection}
        onCreate={handleCreateSection}
        onUpdate={handleUpdateSection}
      />
    </div>
  );
}
