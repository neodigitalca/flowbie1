import type { ReactNode } from "react";
import {
  GENERATOR_TOOLBAR_ACTIONS_CLASS,
  GENERATOR_TOOLBAR_OPTIONS_CLASS,
  GENERATOR_TOOLBAR_PRIMARY_CLASS,
  GENERATOR_TOOLBAR_ROOT_CLASS,
} from "@/components/blog-generator/generator-toolbar-theme";
import { cn } from "@/lib/utils";

export type GeneratorToolbarFrameProps = {
  primary?: ReactNode;
  options?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function GeneratorToolbarFrame({
  primary,
  options,
  actions,
  className,
}: GeneratorToolbarFrameProps) {
  return (
    <div className={cn(GENERATOR_TOOLBAR_ROOT_CLASS, className)} role="toolbar" aria-label="Generator controls">
      {primary ? <div className={GENERATOR_TOOLBAR_PRIMARY_CLASS}>{primary}</div> : null}
      {options ? <div className={GENERATOR_TOOLBAR_OPTIONS_CLASS}>{options}</div> : null}
      {actions ? <div className={GENERATOR_TOOLBAR_ACTIONS_CLASS}>{actions}</div> : null}
    </div>
  );
}
