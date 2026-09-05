import React, { useState } from "react";
import { Bell, Copy } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MANAGER_DISPLAY_DROPDOWN_PANEL,
  managerDisplayErrorLogSquareClass,
} from "@/components/manager/manager-header-chip-styles";
import { useManagerErrorLog } from "@/contexts/manager-error-log-context";
import { copyTextToClipboard } from "@/lib/backlink-research/backlink-bulk-csv-export";
import { cn } from "@/lib/utils";

function formatErrorTime(at: number): string {
  return new Date(at).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function copyErrorText(text: string): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  await copyTextToClipboard(trimmed);
}

export function ManagerErrorLogBell(): React.ReactElement {
  const { entries, clearErrors } = useManagerErrorLog();
  const [open, setOpen] = useState(false);
  const hasErrors = entries.length > 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(managerDisplayErrorLogSquareClass(hasErrors), "relative")}
          aria-label={hasErrors ? `Error logs (${entries.length})` : "Error logs"}
          title={hasErrors ? "Error logs" : "No errors"}
        >
          <Bell className="shrink-0" aria-hidden />
          {hasErrors ? (
            <span
              className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-400"
              aria-hidden
            />
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(MANAGER_DISPLAY_DROPDOWN_PANEL, "w-[min(28rem,calc(100vw-2rem))] p-0")}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <span className="text-base font-normal text-white">Error logs</span>
          {hasErrors ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="text-base text-muted-foreground hover:text-white"
                onClick={() => void copyErrorText(entries.map((e) => e.message).join("\n\n"))}
              >
                Copy all
              </button>
              <button
                type="button"
                className="text-base text-muted-foreground hover:text-white"
                onClick={() => clearErrors()}
              >
                Clear
              </button>
            </div>
          ) : null}
        </div>
        {hasErrors ? (
          <div className="max-h-[min(50vh,24rem)] overflow-y-auto">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex w-full min-w-0 gap-2 px-3 py-2.5 outline-none hover:bg-zinc-900"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="select-text whitespace-pre-wrap break-words text-base text-red-400">
                    {entry.message}
                  </span>
                  <span className="select-text text-base text-muted-foreground">
                    {formatErrorTime(entry.at)}
                  </span>
                </div>
                <button
                  type="button"
                  className="shrink-0 self-start p-1 text-muted-foreground hover:text-white"
                  aria-label="Copy error"
                  title="Copy error"
                  onClick={() => void copyErrorText(entry.message)}
                >
                  <Copy className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-3 pb-3 text-base text-muted-foreground">No errors logged.</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
