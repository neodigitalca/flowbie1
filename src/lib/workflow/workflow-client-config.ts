import { calendarDayOfMonthFromConfig } from "@/lib/workflow/workflow-calendar-start";
import type { WorkflowClientConfig } from "@/lib/workflow/workflow-types";

export type WorkflowClientScope = "all" | "selected";

export function workflowClientScope(config?: WorkflowClientConfig | null): WorkflowClientScope {
  return config?.clientScope === "all" ? "all" : "selected";
}

export function resolveWorkflowClientSiteIds(
  config: WorkflowClientConfig | undefined,
  availableSiteIds: string[],
): string[] {
  if (workflowClientScope(config) === "all") {
    return availableSiteIds.map((id) => id.trim()).filter(Boolean);
  }
  return (config?.siteIds ?? []).map((id) => id.trim()).filter(Boolean);
}

export function workflowClientSiteSummary(
  config: WorkflowClientConfig | undefined,
  sites: Array<{ id: string; name: string }>,
): string {
  if (workflowClientScope(config) === "all") {
    const count = sites.length;
    return count > 0 ? `All clients (${count})` : "All clients";
  }
  const siteIds = config?.siteIds ?? [];
  if (siteIds.length === 0) return "No clients selected";
  if (siteIds.length === 1) {
    const site = sites.find((item) => item.id === siteIds[0]);
    return site?.name ?? "1 client";
  }
  return `${siteIds.length} clients`;
}

function dayOrdinal(day: number): string {
  const remainder = day % 100;
  if (remainder >= 11 && remainder <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

function formatPublishTime(time: string): string {
  const [hourPart, minutePart] = time.trim().slice(0, 5).split(":");
  const hour = Number.parseInt(hourPart ?? "", 10);
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return time;
  const minute = String(minutePart ?? "00").padStart(2, "0");
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minute} ${suffix}`;
}

export function workflowClientPublishSummary(config: WorkflowClientConfig | undefined): string | null {
  if (String(config?.startDate ?? "").trim().length < 10) return null;
  const day = calendarDayOfMonthFromConfig({
    dayOfMonth: config?.dayOfMonth,
    startDate: config?.startDate,
  });
  const time = formatPublishTime(String(config?.time ?? "09:00"));
  return `Publishes ${dayOrdinal(day)} at ${time}`;
}

export function workflowClientVariableSuffix(siteIds: string[], siteId: string): string {
  if (siteIds.length <= 1) return "";
  return `__${siteId.replace(/[^a-z0-9_-]/gi, "_")}`;
}
