import { FORGE_NAV_TEXT_CLASS } from "@/components/manager/pulse-forge/forge-dashboard-styles";
import { cn } from "@/lib/utils";

export type PulseForgeNavMode = "forge" | "recipes" | "workflows";

export type PulseForgeNavSidebarProps = {
  navMode: PulseForgeNavMode;
  workflowEditorOpen: boolean;
  onSelectMyForge: () => void;
  onSelectRecipes: () => void;
  onSelectWorkflows: () => void;
};

export function PulseForgeNavSidebar({
  navMode,
  workflowEditorOpen,
  onSelectMyForge,
  onSelectRecipes,
  onSelectWorkflows,
}: PulseForgeNavSidebarProps): React.ReactElement {
  const forgeHomeActive = navMode === "forge" && !workflowEditorOpen;
  const recipesActive = navMode === "recipes" && !workflowEditorOpen;
  const workflowsActive = navMode === "workflows" && !workflowEditorOpen;

  return (
    <aside className="flex h-full min-h-0 w-56 shrink-0 flex-col bg-zinc-950">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <button
          type="button"
          onClick={onSelectMyForge}
          className={cn(
            "w-full px-4 py-3 text-left",
            FORGE_NAV_TEXT_CLASS,
            forgeHomeActive
              ? "bg-zinc-900 text-white"
              : "text-muted-foreground hover:bg-zinc-900 hover:text-white",
          )}
        >
          My Forge
        </button>
        <button
          type="button"
          onClick={onSelectRecipes}
          className={cn(
            "w-full px-4 py-3 text-left",
            FORGE_NAV_TEXT_CLASS,
            recipesActive
              ? "bg-zinc-900 text-white"
              : "text-muted-foreground hover:bg-zinc-900 hover:text-white",
          )}
        >
          Agents
        </button>
        <button
          type="button"
          onClick={onSelectWorkflows}
          className={cn(
            "w-full px-4 py-3 text-left",
            FORGE_NAV_TEXT_CLASS,
            workflowsActive
              ? "bg-zinc-900 text-white"
              : "text-muted-foreground hover:bg-zinc-900 hover:text-white",
          )}
        >
          Workflows
        </button>
      </div>
    </aside>
  );
}
