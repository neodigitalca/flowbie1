import type { ReactNode } from "react";
import {
  DETAILS_CO_SECTION_BODY,
  DETAILS_CO_STACK,
  DETAILS_DRAWER_BODY_CLASS,
  detailsDrawerRowStripeClass,
} from "@/components/integrations/wordpress/bulk-details-drawer-styles";
import type { BulkProgressSlice } from "@/components/overview/overview-tab-constants";
import { cn } from "@/lib/utils";
import { WorkspaceDetailsPipelineSteps } from "@/components/shared/WorkspaceDetailsPipelineSteps";

export function WorkspaceDetailsStack({ children }: { children: ReactNode }) {
  return (
    <div className={DETAILS_DRAWER_BODY_CLASS}>
      <div className={DETAILS_CO_STACK}>{children}</div>
    </div>
  );
}

export function WorkspaceDetailsSection({
  title,
  stripeIndex = 0,
  children,
}: {
  title?: string;
  defaultOpen?: boolean;
  stripeIndex?: number;
  children: ReactNode;
}) {
  return (
    <div className={detailsDrawerRowStripeClass(stripeIndex)}>
      {title ? (
        <div className="border-0 px-3 py-1.5 text-base font-normal text-white">{title}</div>
      ) : null}
      <div className={DETAILS_CO_SECTION_BODY}>{children}</div>
    </div>
  );
}

export function WorkspaceDetailsKvRow({
  label,
  value,
  stripeIndex,
  whiteLabels = false,
}: {
  label: string;
  value: ReactNode;
  stripeIndex: number;
  whiteLabels?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-0 px-2.5 py-1.5 sm:px-3",
        detailsDrawerRowStripeClass(stripeIndex),
      )}
    >
      <span className={cn("shrink-0", whiteLabels ? "text-white" : "text-muted-foreground")}>{label}</span>
      <span className="min-w-0 text-right text-white [overflow-wrap:anywhere]">{value}</span>
    </div>
  );
}

export function WorkspaceDetailsLiveMessage({
  message,
  stripeIndex = 0,
}: {
  message: string;
  stripeIndex?: number;
}) {
  const text = message.trim();
  if (!text) return null;
  return (
    <div className={detailsDrawerRowStripeClass(stripeIndex)}>
      <div className="border-0 px-2.5 py-1.5 text-base text-white sm:px-3">{text}</div>
    </div>
  );
}

export function WorkspaceDetailsProgressRow({
  label,
  slice,
  stripeIndex,
}: {
  label: string;
  slice: BulkProgressSlice;
  stripeIndex: number;
}) {
  const harnessSteps = slice.pipelineSteps ?? [];
  if (harnessSteps.length > 0) {
    return <WorkspaceDetailsPipelineSteps steps={harnessSteps} />;
  }

  const status = slice.statusMessage?.trim();
  const activeLabel = slice.activeRowLabel?.trim();

  return (
    <div className={detailsDrawerRowStripeClass(stripeIndex)}>
      {status ? (
        <div className="border-0 px-2.5 py-1.5 text-base text-white sm:px-3">{status}</div>
      ) : (
        <div className="flex min-h-9 items-center justify-between gap-2 border-0 px-2.5 py-1.5 sm:px-3">
          <span className="min-w-0 flex-1 text-white">{label}</span>
        </div>
      )}
      {activeLabel ? (
        <div className="border-0 px-2.5 pb-1.5 text-base text-white sm:px-3">{activeLabel}</div>
      ) : null}
    </div>
  );
}
