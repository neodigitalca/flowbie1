import { TeamsSettingsContent } from "@/components/manager/TeamsSettingsContent";
import { SEO_WORKSPACE_BODY_SCROLL_CLASS, SEO_WORKSPACE_SHELL_CLASS } from "@/components/seo/seo-workspace-layout";
import { cn } from "@/lib/utils";

export function UsersTabContent() {
  return (
    <div className={cn(SEO_WORKSPACE_SHELL_CLASS, "font-sans text-base")}>
      <div className={SEO_WORKSPACE_BODY_SCROLL_CLASS}>
        <TeamsSettingsContent />
      </div>
    </div>
  );
}
