import type { ManagerSettingsClusterId } from "@/components/manager/manager-settings-cluster";

export const DASHBOARD_SECTION_ORDER: readonly ManagerSettingsClusterId[] = [
  "properties",
  "api-keys",
  "master-rules",
  "ai-generation",
  "google",
  "wp-engine",
] as const;

export const DASHBOARD_SECTION_LABELS: Record<ManagerSettingsClusterId, string> = {
  properties: "Properties",
  "api-keys": "API Keys",
  "master-rules": "Master Rules",
  "ai-generation": "AI & Models",
  google: "Google",
  "wp-engine": "WP Engine",
};
