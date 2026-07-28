import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface BlogGeneratorTabHeaderProps {
  icon: LucideIcon;
  title: string;
  /** Optional; omitted for a title-only header. */
  description?: ReactNode;
  actions?: ReactNode;
}

export function BlogGeneratorTabHeader({
  icon: Icon,
  title,
  description,
  actions,
}: BlogGeneratorTabHeaderProps) {
  return (
    <div className={description ? "space-y-2" : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <h2 className="font-sans text-xl font-semibold text-white">{title}</h2>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {description ? <p className="font-sans text-base text-muted-foreground">{description}</p> : null}
    </div>
  );
}
