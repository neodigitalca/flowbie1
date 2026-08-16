import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { notify } from "@/lib/app-notifications";
import type { WordPressSite } from "../types";
import { deployNeoPulseWpPlugin } from "@/lib/wpengine-api";
import {
  TaskFormFlatGrid,
  TaskFormPlaceholderCell,
  TaskFormSideSection,
  TASK_FORM_FLAT_CONTROL_CLASS,
} from "@/components/manager/tasks/TaskFormLayout";

export type WpEnginePropertyPanelProps = {
  site: WordPressSite;
  onPatchSite?: (siteId: string, patch: Partial<WordPressSite>) => void;
};

export const WpEnginePropertyPanel: React.FC<WpEnginePropertyPanelProps> = ({
  site,
  onPatchSite,
}) => {
  const [row, setRow] = useState(site);
  const [deploying, setDeploying] = useState(false);

  useEffect(() => {
    setRow(site);
  }, [site]);

  const patchField = useCallback(
    (patch: Partial<WordPressSite>) => {
      setRow((prev) => {
        const next = { ...prev, ...patch };
        onPatchSite?.(site.id, patch);
        return next;
      });
    },
    [onPatchSite, site.id],
  );

  const handleDeploy = useCallback(async () => {
    setDeploying(true);
    try {
      const result = await deployNeoPulseWpPlugin(row);
      if (!result.ok) {
        notify.error(result.error || "Upload failed");
      }
    } finally {
      setDeploying(false);
    }
  }, [row]);

  const flatInputClass = `${TASK_FORM_FLAT_CONTROL_CLASS} text-white placeholder:text-white/55`;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 pt-2">
      <TaskFormSideSection title="WP Engine SFTP">
        <TaskFormFlatGrid className="grid-cols-2">
          <TaskFormPlaceholderCell>
            <Input
              value={row.wpEngineHost ?? ""}
              placeholder="SFTP host"
              aria-label="SFTP host"
              className={flatInputClass}
              onChange={(e) => patchField({ wpEngineHost: e.target.value })}
            />
          </TaskFormPlaceholderCell>
          <TaskFormPlaceholderCell>
            <Input
              value={row.wpEnginePort != null ? String(row.wpEnginePort) : ""}
              placeholder="2222"
              aria-label="SFTP port"
              className={flatInputClass}
              onChange={(e) => {
                const raw = e.target.value.trim();
                patchField({ wpEnginePort: raw ? Number(raw) || 2222 : undefined });
              }}
            />
          </TaskFormPlaceholderCell>
          <TaskFormPlaceholderCell>
            <Input
              value={row.wpEngineUsername ?? ""}
              placeholder="SFTP username"
              aria-label="SFTP username"
              className={flatInputClass}
              onChange={(e) => patchField({ wpEngineUsername: e.target.value })}
            />
          </TaskFormPlaceholderCell>
          <TaskFormPlaceholderCell>
            <Input
              value={row.wpEnginePassword ?? ""}
              placeholder="SFTP password"
              aria-label="SFTP password"
              className={flatInputClass}
              onChange={(e) => patchField({ wpEnginePassword: e.target.value })}
            />
          </TaskFormPlaceholderCell>
          <TaskFormPlaceholderCell className="col-span-2">
            <Input
              value={row.wpEngineDomain ?? ""}
              placeholder="Domain"
              aria-label="CSV domain"
              className={flatInputClass}
              onChange={(e) => patchField({ wpEngineDomain: e.target.value })}
            />
          </TaskFormPlaceholderCell>
        </TaskFormFlatGrid>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-9 shrink-0 border-0 bg-[#77AA00] text-base text-black hover:bg-[#77AA00]/90"
            onClick={() => void handleDeploy()}
          >
            {deploying ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
            Upload neo-pulse-wp
          </Button>
        </div>
      </TaskFormSideSection>
    </div>
  );
};
