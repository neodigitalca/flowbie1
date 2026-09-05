import { useEffect, useMemo, useRef } from "react";
import { WorkspacePill } from "@/components/shared/WorkspacePill";
import {
  AGENT_RUN_SIDEBAR_BUCKET_KEYS,
  agentRunBucketIcon,
  agentRunBucketTooltipLabel,
} from "@/lib/agent-runs/agent-run-bucket-icons";
import type { AgentRunBucketGroup, AgentRunBucketKey } from "@/lib/agent-runs/agent-run-grouping";
import { cn } from "@/lib/utils";

export type AgentRunsBucketTabsProps = {
  buckets: AgentRunBucketGroup[];
  value: AgentRunBucketKey;
  onChange: (key: AgentRunBucketKey) => void;
  className?: string;
  mode?: "labeled" | "iconRail";
};

export function AgentRunsBucketTabs({
  buckets,
  value,
  onChange,
  className,
  mode = "labeled",
}: AgentRunsBucketTabsProps) {
  const tabsRef = useRef<HTMLDivElement>(null);

  const countByKey = useMemo(() => {
    const map = new Map<AgentRunBucketKey, number>();
    for (const bucket of buckets) {
      map.set(bucket.key, bucket.runs.length);
    }
    return map;
  }, [buckets]);

  const activeByKey = useMemo(() => {
    const map = new Map<AgentRunBucketKey, number>();
    for (const bucket of buckets) {
      map.set(bucket.key, bucket.activeCount);
    }
    return map;
  }, [buckets]);

  useEffect(() => {
    const container = tabsRef.current;
    if (!container) return;
    const activeTab = container.querySelector<HTMLElement>('button[aria-pressed="true"]');
    if (!activeTab) return;
    const tabRight = activeTab.offsetLeft + activeTab.offsetWidth;
    const viewRight = container.scrollLeft + container.clientWidth;
    if (tabRight > viewRight) {
      container.scrollLeft = tabRight - container.clientWidth;
    } else if (activeTab.offsetLeft < container.scrollLeft) {
      container.scrollLeft = activeTab.offsetLeft;
    }
  }, [value, buckets.length, mode]);

  if (mode === "labeled" && buckets.length === 0) return null;

  const railKeys = mode === "iconRail" ? AGENT_RUN_SIDEBAR_BUCKET_KEYS : buckets.map((b) => b.key);

  return (
    <div
      ref={tabsRef}
      className={cn(
        "agent-runs-client-group__tabs",
        mode === "iconRail" && "agent-runs-bucket-icon-rail",
        className,
      )}
      role="tablist"
      aria-label="Run categories"
    >
      {mode === "iconRail"
        ? railKeys.map((key) => {
            const count = countByKey.get(key) ?? 0;
            const activeRuns = activeByKey.get(key) ?? 0;
            const selected = key === value;
            const Icon = agentRunBucketIcon(key);
            const tooltip = agentRunBucketTooltipLabel(key, count, activeRuns);
            return (
              <WorkspacePill
                key={key}
                label={tooltip}
                icon={Icon}
                iconOnly
                active={selected}
                square
                tone="monochrome"
                onClick={() => onChange(key)}
                className={cn(
                  "agent-runs-client-group__tab agent-runs-bucket-icon-rail__pill",
                  selected && key === "reporting" && "agent-runs-bucket-icon-rail__pill--reporting",
                  activeRuns > 0 && "agent-runs-bucket-icon-rail__pill--has-active",
                )}
              />
            );
          })
        : buckets.map((bucket) => {
            const selected = bucket.key === value;
            return (
              <WorkspacePill
                key={bucket.key}
                label={`${bucket.label} (${bucket.runs.length})`}
                active={selected}
                square
                tone="monochrome"
                onClick={() => onChange(bucket.key)}
                className={cn(
                  "agent-runs-client-group__tab",
                  bucket.activeCount > 0 && "agent-runs-bucket-icon-rail__pill--has-active",
                )}
              />
            );
          })}
    </div>
  );
}
