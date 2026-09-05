import React, { useMemo, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { WordPressSiteOption } from "@/components/manager/tasks/NewProjectDialog";
import { WorkflowInspectorGroup } from "@/components/manager/workflow/WorkflowInspectorLayout";
import { workflowClientScope } from "@/lib/workflow/workflow-client-config";
import type { WorkflowClientConfig } from "@/lib/workflow/workflow-types";
import { cn } from "@/lib/utils";

export type WorkflowClientInspectorFieldsProps = {
  config: WorkflowClientConfig;
  sites: WordPressSiteOption[];
  onChange: (config: WorkflowClientConfig) => void;
  /** Lifted open state so select/deselect re-renders cannot reset the menu. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function WorkflowClientInspectorFields({
  config,
  sites,
  onChange,
  open,
  onOpenChange,
}: WorkflowClientInspectorFieldsProps): React.ReactElement {
  const ignoreCloseRef = useRef(false);
  const legacyAll = workflowClientScope(config) === "all";
  const siteIds = config.siteIds ?? [];
  const allSiteIds = useMemo(() => sites.map((site) => site.id), [sites]);

  const selectedIds = useMemo(() => {
    if (legacyAll) return allSiteIds;
    return siteIds;
  }, [allSiteIds, legacyAll, siteIds]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = sites.length > 0 && sites.every((site) => selectedSet.has(site.id));
  const someSelected = sites.some((site) => selectedSet.has(site.id));
  const masterChecked = allSelected ? true : someSelected ? "indeterminate" : false;

  const triggerLabel = useMemo(() => {
    if (allSelected) return "All clients";
    if (selectedIds.length === 0) return "Clients";
    return selectedIds
      .map((id) => sites.find((site) => site.id === id)?.name ?? id)
      .join(", ");
  }, [allSelected, selectedIds, sites]);

  const withMenuLocked = (action: () => void) => {
    ignoreCloseRef.current = true;
    action();
    onOpenChange(true);
    window.setTimeout(() => {
      ignoreCloseRef.current = false;
    }, 0);
  };

  const setAll = (checked: boolean) => {
    withMenuLocked(() => {
      onChange({
        ...config,
        clientScope: "selected",
        siteIds: checked ? allSiteIds : [],
      });
    });
  };

  const toggleSite = (siteId: string) => {
    withMenuLocked(() => {
      const current = legacyAll ? allSiteIds : siteIds;
      const next = current.includes(siteId)
        ? current.filter((id) => id !== siteId)
        : [...current, siteId];
      onChange({ ...config, clientScope: "selected", siteIds: next });
    });
  };

  return (
    <WorkflowInspectorGroup title="Clients">
      <Popover
        open={open}
        modal={false}
        onOpenChange={(next) => {
          if (!next && ignoreCloseRef.current) {
            onOpenChange(true);
            return;
          }
          onOpenChange(next);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex min-h-12 w-full items-center justify-between gap-2 rounded-none bg-black px-4 py-3 text-left text-base outline-none",
              triggerLabel === "Clients" ? "text-muted-foreground" : "text-white",
            )}
            aria-label="Clients"
            aria-expanded={open}
          >
            <span className="min-w-0 flex-1 truncate">{triggerLabel}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => {
            if (ignoreCloseRef.current) event.preventDefault();
          }}
          onFocusOutside={(event) => {
            event.preventDefault();
          }}
          onInteractOutside={(event) => {
            if (ignoreCloseRef.current) event.preventDefault();
          }}
          className="w-[var(--radix-popover-trigger-width)] rounded-none border-0 bg-black p-1 text-white shadow-lg"
        >
          <div
            className="flex max-h-56 flex-col gap-0.5 overflow-y-auto"
            onPointerDown={() => {
              ignoreCloseRef.current = true;
            }}
            onPointerUp={() => {
              window.setTimeout(() => {
                ignoreCloseRef.current = false;
              }, 0);
            }}
          >
            <label
              className="flex cursor-pointer items-center gap-2 rounded-none px-2 py-1.5 hover:bg-zinc-900"
              onPointerDown={(event) => event.preventDefault()}
            >
              <Checkbox
                checked={masterChecked}
                onCheckedChange={(checked) => setAll(checked === true)}
                className="rounded-none border-zinc-600 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
              />
              <span className="min-w-0 flex-1 truncate text-base text-white">All clients</span>
            </label>
            {sites.map((site) => {
              const checked = selectedSet.has(site.id);
              return (
                <label
                  key={site.id}
                  className="flex cursor-pointer items-center gap-2 rounded-none px-2 py-1.5 hover:bg-zinc-900"
                  onPointerDown={(event) => event.preventDefault()}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleSite(site.id)}
                    className="rounded-none border-zinc-600 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                  />
                  <span className="min-w-0 flex-1 truncate text-base text-white">{site.name}</span>
                </label>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </WorkflowInspectorGroup>
  );
}
