import { BULK_GENERATOR_EMPTY_ROW_COUNT } from "@/components/keyword-research/blog-generator-tab-classes";
import {
  CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS,
  CONTENT_OPTIMIZER_MULTI_SITE_ROW_WRAPPER_CLASS,
  CONTENT_OPTIMIZER_PAGE_ROW_GRID_CLASS,
  contentOptimizerRowStripeClass,
} from "@/components/overview/overview-tab/overview-tab-content-constants";
import { cn } from "@/lib/utils";

export type WorkspaceEmptyRowStripesProps = {
  count?: number;
};

export function WorkspaceEmptyRowStripes({
  count = BULK_GENERATOR_EMPTY_ROW_COUNT,
}: WorkspaceEmptyRowStripesProps) {
  return (
    <div
      className={cn(
        CONTENT_OPTIMIZER_MULTI_SITE_ROW_STACK_CLASS,
        "flex min-h-0 flex-1 flex-col overflow-hidden",
      )}
      aria-hidden
    >
      {Array.from({ length: count }, (_, stripeIndex) => (
        <div key={stripeIndex} className={CONTENT_OPTIMIZER_MULTI_SITE_ROW_WRAPPER_CLASS}>
          <div
            className={cn(
              contentOptimizerRowStripeClass(stripeIndex),
              CONTENT_OPTIMIZER_PAGE_ROW_GRID_CLASS,
            )}
          />
        </div>
      ))}
    </div>
  );
}
