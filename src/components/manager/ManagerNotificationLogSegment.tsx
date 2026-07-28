import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Info,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MANAGER_DISPLAY_DROPDOWN_PANEL,
  managerDisplayNotifySquareButtonClass,
} from "@/components/manager/manager-header-chip-styles";
import {
  MANAGER_NAV_DROPDOWN_ITEM_BASE,
  managerNavDropdownRowClass,
} from "@/components/manager/manager-top-bar-nav-styles";
import {
  getAppNotificationState,
  NOTIFICATION_LOG_DISPLAY_CAP,
  subscribeAppNotifications,
  type NotifyVariant,
} from "@/lib/app-notifications";
import { cn } from "@/lib/utils";

function VariantIcon({ variant }: { variant: NotifyVariant }) {
  const className = "h-4 w-4 shrink-0";
  switch (variant) {
    case "success":
      return <CheckCircle2 className={className} aria-hidden />;
    case "error":
      return <AlertCircle className={className} aria-hidden />;
    case "warning":
      return <AlertTriangle className={className} aria-hidden />;
    case "loading":
      return <Info className={className} aria-hidden />;
    default:
      return <Info className={className} aria-hidden />;
  }
}

export function ManagerNotificationLogSegment({
  variant,
  dropdownAnimateClass,
}: {
  variant: "embedded" | "compact";
  dropdownAnimateClass: string;
}) {
  const [state, setState] = useState(getAppNotificationState);

  useEffect(() => subscribeAppNotifications(() => setState(getAppNotificationState())), []);

  const primaryVariant = state.primary?.variant ?? null;
  const logItems = state.history.slice(0, NOTIFICATION_LOG_DISPLAY_CAP);

  const dropdownItemClass = (index: number) =>
    variant === "embedded"
      ? cn(MANAGER_NAV_DROPDOWN_ITEM_BASE, managerNavDropdownRowClass(index, false))
      : "cursor-pointer rounded-none px-3 py-2.5 text-base font-normal outline-none focus:bg-zinc-800/90 data-[highlighted]:bg-zinc-800/90";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={managerDisplayNotifySquareButtonClass(primaryVariant)}
          aria-label="Notifications"
          aria-haspopup="menu"
        >
          {primaryVariant ? (
            <VariantIcon variant={primaryVariant} />
          ) : (
            <Bell className="h-4 w-4 shrink-0" aria-hidden />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={cn(MANAGER_DISPLAY_DROPDOWN_PANEL, "w-auto min-w-36", dropdownAnimateClass)}
      >
        {logItems.length === 0 ? (
          <DropdownMenuItem disabled className={cn(dropdownItemClass(0), "opacity-70")}>
            <span className="text-base text-muted-foreground">No notifications yet</span>
          </DropdownMenuItem>
        ) : (
          logItems.map((item, index) => (
            <DropdownMenuItem
              key={item.id}
              className={cn(dropdownItemClass(index), "shrink-0 cursor-default focus:bg-inherit data-[highlighted]:bg-inherit")}
              onSelect={(e) => e.preventDefault()}
            >
              <div className="flex w-full shrink-0 items-start gap-2.5 py-0.5">
                <VariantIcon variant={item.variant} />
                <div className="min-w-0 flex-1 select-text">
                  <p className="text-base font-normal leading-tight text-foreground">
                    {item.title}
                  </p>
                  {item.description ? (
                    <p className="mt-0.5 text-base text-muted-foreground">{item.description}</p>
                  ) : null}
                </div>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
