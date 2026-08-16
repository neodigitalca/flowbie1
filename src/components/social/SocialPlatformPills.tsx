import type { LucideIcon } from "lucide-react";
import { CalendarDays, Megaphone, Sparkles } from "lucide-react";
import { WorkspacePill } from "@/components/shared/WorkspacePill";

export type SocialPlatformTab = "gbp-post" | "content-calendar" | "social-creator";

const PLATFORMS: { id: SocialPlatformTab; label: string; icon: LucideIcon }[] = [
  { id: "gbp-post", label: "GBP", icon: Megaphone },
  { id: "content-calendar", label: "Calendar", icon: CalendarDays },
  { id: "social-creator", label: "Creator", icon: Sparkles },
];

export type SocialPlatformPillsProps = {
  active: SocialPlatformTab;
  onSelect: (tab: SocialPlatformTab) => void;
  disabled?: boolean;
};

export function SocialPlatformPills({ active, onSelect, disabled = false }: SocialPlatformPillsProps) {
  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-1" role="group" aria-label="Social platform">
      {PLATFORMS.map(({ id, label, icon }) => (
        <WorkspacePill
          key={id}
          label={label}
          icon={icon}
          iconOnly
          square
          active={active === id}
          disabled={disabled}
          onClick={() => onSelect(id)}
        />
      ))}
    </div>
  );
}
