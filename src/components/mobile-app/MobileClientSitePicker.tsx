import { ChevronDown } from "lucide-react";
import { useWordPressSites } from "@/hooks/use-wordpress-sites";
import { useActiveWordPressSite } from "@/contexts/active-wordpress-site-context";
import { wordpressSiteDisplayName } from "@/lib/wordpress-site-display-name";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function MobileClientSitePicker() {
  const { sites, handleConnectSite } = useWordPressSites();
  const { activeWordPressSiteId, setActiveWordPressSiteId } = useActiveWordPressSite();

  const enabledSites = sites.filter((site) => site.enabled !== false);
  const activeSite = enabledSites.find((site) => site.id === activeWordPressSiteId) ?? enabledSites[0] ?? null;
  const label = activeSite ? wordpressSiteDisplayName(activeSite) : "Select client";

  if (enabledSites.length === 0) {
    return (
      <span className="mobile-client-picker mobile-client-picker--empty text-base text-muted-foreground">
        No clients
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="mobile-client-picker"
          aria-label={`Active client: ${label}`}
        >
          <span className="mobile-client-picker__label truncate">{label}</span>
          <ChevronDown className="mobile-client-picker__chevron h-4 w-4 shrink-0" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="mobile-client-picker__menu">
        {enabledSites.map((site) => {
          const selected = site.id === activeSite?.id;
          const siteLabel = wordpressSiteDisplayName(site);
          return (
            <DropdownMenuItem
              key={site.id}
              className={cn("mobile-client-picker__item text-base", selected && "mobile-client-picker__item--selected")}
              onSelect={() => {
                if (selected) return;
                handleConnectSite(site);
                setActiveWordPressSiteId(site.id);
              }}
            >
              <span className="truncate">{siteLabel}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
