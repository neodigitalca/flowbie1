import React from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatAlertItem } from "@/lib/chat-preferences-types";
import {
  CHAT_SIDEBAR_ROW,
  CHAT_SIDEBAR_ROW_ACTIVE,
  CHAT_SIDEBAR_SECTION_LABEL,
} from "@/components/chat/chat-theme";

type Props = {
  alerts: ChatAlertItem[];
  activeAlertId: string | null;
  onOpenAlert: (alert: ChatAlertItem) => void;
  onDismiss: (alertId: string) => void;
};

export function ChatAlertsList({
  alerts,
  activeAlertId,
  onOpenAlert,
  onDismiss,
}: Props): React.ReactElement | null {
  if (alerts.length === 0) return null;

  return (
    <div className="mt-4 px-1">
      <div className="flex items-center gap-2 py-2">
        <Bell className="h-4 w-4 chat-text-muted" />
        <span className={CHAT_SIDEBAR_SECTION_LABEL}>Alerts</span>
        <span className="ml-auto rounded-full bg-primary/20 px-2 py-0.5 text-base font-semibold">
          {alerts.length}
        </span>
      </div>
      <div className="space-y-0.5">
        {alerts.map((alert) => (
          <div key={alert.id} className="flex items-stretch gap-1">
            <button
              type="button"
              onClick={() => onOpenAlert(alert)}
              className={cn(
                CHAT_SIDEBAR_ROW,
                "min-w-0 flex-1 py-[var(--chat-row-py,0.375rem)]",
                activeAlertId === alert.id && CHAT_SIDEBAR_ROW_ACTIVE,
              )}
            >
              <span className="min-w-0 flex-1 truncate">
                <span className="font-semibold">{alert.channelLabel}</span>
                <span className="chat-text-muted"> · {alert.bodyPreview}</span>
              </span>
            </button>
            <button
              type="button"
              aria-label="Dismiss alert"
              className="shrink-0 px-2 text-base chat-text-muted hover:text-foreground"
              onClick={() => onDismiss(alert.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
