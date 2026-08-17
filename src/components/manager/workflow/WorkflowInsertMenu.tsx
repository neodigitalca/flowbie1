import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutomationRecipeLibrary } from "@/components/manager/tasks/recipes/AutomationRecipeLibrary";
import { FORGE_RECIPE_CARD_TILE_CLASS } from "@/components/manager/pulse-forge/forge-recipe-styles";
import { defaultNodeLabel } from "@/lib/workflow/workflow-graph-utils";
import type { AutomationRecipeCatalogItem } from "@/lib/automation-recipes-types";
import type { WorkflowNodeKind } from "@/lib/workflow/workflow-types";
import { cn } from "@/lib/utils";

const STEP_KINDS: WorkflowNodeKind[] = [
  "trigger_manual",
  "trigger_calendar",
  "trigger_gsc",
  "trigger_document",
  "trigger_agent_done",
  "action_agent",
  "path_rules",
  "rag_archive",
];

export type WorkflowInsertMenuProps = {
  teamId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddStep: (kind: WorkflowNodeKind) => void;
  onAddRecipe: (recipe: AutomationRecipeCatalogItem) => void;
};

export function WorkflowInsertMenu({
  teamId,
  open,
  onOpenChange,
  onAddStep,
  onAddRecipe,
}: WorkflowInsertMenuProps): React.ReactElement {
  const close = () => onOpenChange(false);

  const pickRecipe = (recipe: AutomationRecipeCatalogItem) => {
    onAddRecipe(recipe);
    close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex h-[min(920px,92vh)] w-[min(1440px,96vw)] max-w-none flex-col gap-0",
          "border-0 bg-black p-0 shadow-tile-pop",
        )}
      >
        <DialogHeader className="shrink-0 border-b border-white/10 px-6 py-4">
          <DialogTitle className="text-base font-semibold text-white">Add to workflow</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="recipes" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="grid h-auto w-full shrink-0 grid-cols-2 rounded-none bg-zinc-950 p-0">
            <TabsTrigger
              value="recipes"
              className="rounded-none py-3 text-base data-[state=active]:bg-black data-[state=active]:text-primary"
            >
              Agents
            </TabsTrigger>
            <TabsTrigger
              value="steps"
              className="rounded-none py-3 text-base data-[state=active]:bg-black data-[state=active]:text-primary"
            >
              Steps
            </TabsTrigger>
          </TabsList>
          <TabsContent value="recipes" className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
            <AutomationRecipeLibrary
              teamId={teamId}
              sites={[]}
              onRecipeClick={pickRecipe}
              onRecipeInstall={pickRecipe}
            />
          </TabsContent>
          <TabsContent value="steps" className="mt-0 min-h-0 flex-1 overflow-y-auto p-6 data-[state=inactive]:hidden">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {STEP_KINDS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  className={cn(
                    FORGE_RECIPE_CARD_TILE_CLASS,
                    "border-l-[length:var(--tile-accent-width)] border-l-primary p-4 text-left hover:shadow-tile-pop",
                  )}
                  onClick={() => {
                    onAddStep(kind);
                    close();
                  }}
                >
                  <p className="text-base font-semibold text-white">{defaultNodeLabel(kind)}</p>
                  <p className="mt-1 text-base text-muted-foreground">{kind.replace(/_/g, " ")}</p>
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
