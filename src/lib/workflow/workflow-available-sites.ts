import { getStoredSites } from "@/components/integrations/storage";

export function listWorkflowAvailableSiteIds(): string[] {
  return getStoredSites()
    .map((site) => site.id.trim())
    .filter(Boolean);
}
