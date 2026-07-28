import { useState, type ReactNode, type SyntheticEvent } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { GoogleAdsRowEndRail } from "@/components/ppc/google/GoogleAdsRowEndRail";
import { PPC_ROW_CONTENT_SPAN_CLASS } from "@/components/ppc/google/google-ads-row-constants";
import { cn } from "@/lib/utils";

export const PPC_DETAILS_ACCORDION_STACK = "flex flex-col gap-2.5 rounded-none pt-1";

export const PPC_DETAILS_TRIGGER =
  "grid w-full min-w-0 min-h-[3rem] grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,0.85fr)_7rem] items-center gap-x-2 rounded-none border-0 bg-zinc-950 py-1.5 text-left text-base font-medium text-white sm:min-h-[3.25rem] sm:gap-x-3";

export const PPC_DETAILS_SUBTRIGGER = cn(PPC_DETAILS_TRIGGER, "bg-zinc-900/80");

export type GoogleAdsDetailsSectionProps = {
  title: string;
  titlePrefix?: string;
  titleField?: {
    value: string;
    readOnly?: boolean;
    placeholder?: string;
    ariaLabel?: string;
    onChange?: (value: string) => void;
  };
  badge?: string | number;
  icon?: ReactNode;
  defaultOpen?: boolean;
  nested?: boolean;
  headerAction?: ReactNode;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  deleteLabel?: string;
  children: ReactNode;
  contentClassName?: string;
};

function stopFieldActivation(e: SyntheticEvent) {
  e.stopPropagation();
}

function EndRailGenerateWrap({ children }: { children: ReactNode }) {
  return (
    <span onClick={stopFieldActivation} onMouseDown={stopFieldActivation}>
      {children}
    </span>
  );
}

function SectionTitle({
  title,
  badge,
}: {
  title: string;
  badge?: string | number;
}) {
  return (
    <span className="min-w-0 flex-1 truncate text-left">
      {title}
      {badge !== undefined ? (
        <span className="ml-2 tabular-nums text-sky-400">{badge}</span>
      ) : null}
    </span>
  );
}

export function GoogleAdsDetailsSection({
  title,
  titlePrefix,
  titleField,
  badge,
  icon,
  defaultOpen = false,
  nested = false,
  headerAction,
  onDelete,
  deleteDisabled = false,
  deleteLabel,
  children,
  contentClassName,
}: GoogleAdsDetailsSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const triggerClass = nested ? PPC_DETAILS_SUBTRIGGER : PPC_DETAILS_TRIGGER;

  const endRail = (chevronAsCollapsibleTrigger: boolean) => (
    <GoogleAdsRowEndRail
      generate={headerAction ? <EndRailGenerateWrap>{headerAction}</EndRailGenerateWrap> : undefined}
      onDelete={onDelete}
      deleteDisabled={deleteDisabled}
      deleteLabel={deleteLabel}
      chevron={
        chevronAsCollapsibleTrigger ? (
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-white"
              aria-label={open ? "Collapse section" : "Expand section"}
            >
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
                aria-hidden
              />
            </button>
          </CollapsibleTrigger>
        ) : (
          <ChevronDown
            className={cn("h-4 w-4 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        )
      }
    />
  );

  const header = titleField ? (
    <div className={triggerClass}>
      <div className={PPC_ROW_CONTENT_SPAN_CLASS}>
        {icon ? <span className="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4">{icon}</span> : null}
        {titlePrefix ? (
          <span className="shrink-0 text-base font-medium text-white">{titlePrefix}</span>
        ) : null}
        <input
          type="text"
          value={titleField.value}
          readOnly={titleField.readOnly}
          placeholder={titleField.placeholder}
          aria-label={titleField.ariaLabel ?? title}
          className="h-8 min-w-0 flex-1 border-0 bg-zinc-900 px-2 text-base font-medium text-white shadow-none outline-none placeholder:text-muted-foreground read-only:cursor-default"
          onClick={stopFieldActivation}
          onKeyDown={stopFieldActivation}
          onChange={titleField.onChange ? (e) => titleField.onChange?.(e.target.value) : undefined}
        />
      </div>
      {endRail(true)}
    </div>
  ) : (
    <CollapsibleTrigger asChild>
      <button type="button" className={triggerClass}>
        <div className={PPC_ROW_CONTENT_SPAN_CLASS}>
          {icon ? <span className="inline-flex shrink-0 [&_svg]:h-4 [&_svg]:w-4">{icon}</span> : null}
          <SectionTitle title={title} badge={badge} />
        </div>
        {endRail(false)}
      </button>
    </CollapsibleTrigger>
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      {header}
      <CollapsibleContent className={cn("space-y-2 pt-2", contentClassName)}>{children}</CollapsibleContent>
    </Collapsible>
  );
}
