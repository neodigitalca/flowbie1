import type { LucideIcon } from "lucide-react";
import {
  Building2,
  UserRound,
  Users,
  Cloud,
  Crosshair,
  GitMerge,
  Key,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  Megaphone,
  MessageCircle,
  CheckSquare,
  Share2,
  ScrollText,
  Search,
  Sparkles,
  Server,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { ManagerSettingsClusterId } from "@/components/manager/manager-settings-cluster";

export type ManagerNavItem = {
  /** Stable key when multiple items share the same `value` (e.g. Generator sections). */
  id?: string;
  value: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Nested mega menu rows (parent is a submenu trigger only). */
  children?: ManagerNavItem[];
  /** Selects Dashboard tab and this settings section (in-page nav hidden). */
  dashboardCluster?: ManagerSettingsClusterId;
  /** Opens a React Router path outside manager tabs (e.g. /docs). */
  docsPath?: string;
};

export type ManagerNavSection = {
  id: string;
  label: string;
  /** Shown on the top nav trigger (neon semantic green when section is active). */
  icon: LucideIcon;
  items: ManagerNavItem[];
};

export const MANAGER_NAV_SECTIONS: ManagerNavSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [
      {
        value: "dashboard-properties",
        label: "Properties",
        description: "WordPress sites and integrations",
        icon: Building2,
        dashboardCluster: "properties",
      },
      {
        value: "dashboard-api-keys",
        label: "API Keys",
        description: "OpenRouter and DataForSEO",
        icon: Key,
        dashboardCluster: "api-keys",
      },
      {
        value: "dashboard-master-rules",
        label: "Master Rules",
        description: "Per-site client instructions in Supabase",
        icon: ScrollText,
        dashboardCluster: "master-rules",
      },
      {
        value: "dashboard-ai-generation",
        label: "AI & Models",
        description: "Default model and generation parameters",
        icon: Sparkles,
        dashboardCluster: "ai-generation",
      },
      {
        value: "dashboard-google",
        label: "Google Services",
        description: "Analytics and Search Console",
        icon: Cloud,
        dashboardCluster: "google",
      },
      {
        value: "dashboard-wp-engine",
        label: "WP Engine",
        description: "SFTP catalog and neo-pulse-wp deploy",
        icon: Server,
        dashboardCluster: "wp-engine",
      },
    ],
  },
  {
    id: "teams",
    label: "Teams",
    icon: Users,
    items: [
      {
        value: "users",
        label: "Users",
        description: "Agency seats, invites, and member profiles",
        icon: UserRound,
      },
      {
        value: "chat",
        label: "Chat",
        description: "Team channels and direct messages",
        icon: MessageCircle,
      },
      {
        value: "tasks",
        label: "Tasks",
        description: "Team projects, tasks, and notes",
        icon: CheckSquare,
      },
      {
        value: "pulse-forge",
        label: "Pulse Forge",
        description: "WHEN/THEN SEO automations, recipes, and schedules",
        icon: Zap,
      },
      {
        value: "support",
        label: "Support",
        description: "Pulse Assist tickets, chat logs, and export",
        icon: LifeBuoy,
      },
    ],
  },
  {
    id: "seo",
    label: "SEO",
    icon: Search,
    items: [
      {
        value: "generator",
        label: "Generator",
        description: "Opt, CSV, prompt, import, PR, entity, flow, image, research, and report",
        icon: TrendingUp,
      },
      {
        value: "sitemap-optimizer",
        label: "Sitemap",
        description: "Cluster, merge, publish overlapping URLs, legacy redirects, and URL optimization",
        icon: GitMerge,
      },
      {
        value: "vertical-benchmarks",
        label: "Industry verticals",
        description: "GSC top 10 per NEO Pulse property, bulk CSV packages",
        icon: Layers,
      },
    ],
  },
  {
    id: "social",
    label: "Social",
    icon: Share2,
    items: [
      {
        value: "gbp-post",
        label: "GBP",
        description: "Keyword harness, site image match, money-page button, publish to Google Business Profile",
        icon: Megaphone,
      },
      {
        value: "content-calendar",
        label: "Calendar",
        description: "AI content calendar sheet",
        icon: TrendingUp,
      },
      {
        value: "social-creator",
        label: "Creator",
        description: "Organic post generator with visuals",
        icon: TrendingUp,
      },
    ],
  },
  {
    id: "ppc",
    label: "PPC",
    icon: Target,
    items: [
      {
        value: "ppc-google",
        label: "Google",
        description: "Search campaigns from WordPress pages and GSC queries",
        icon: Crosshair,
      },
      {
        value: "ppc-meta",
        label: "Meta",
        description: "Feed ads from WordPress page copy and Neo Digital creative",
        icon: Megaphone,
      },
    ],
  },
];

/** Nav sections for the active build. */
export function getManagerNavSections(): ManagerNavSection[] {
  return MANAGER_NAV_SECTIONS;
}

/** True when the item or any nested child matches the active workspace tab. */
export function isManagerNavItemActive(
  managerTab: string,
  item: ManagerNavItem,
  dashboardCluster: ManagerSettingsClusterId | undefined,
): boolean {
  if (item.children?.length) {
    return item.children.some((child) => isManagerNavItemSelected(managerTab, child, dashboardCluster));
  }
  return isManagerNavItemSelected(managerTab, item, dashboardCluster);
}

/** Mega menu: dashboard rows use `dashboardCluster`; blog generator uses inner side tabs. */
export function isManagerNavItemSelected(
  managerTab: string,
  item: ManagerNavItem,
  dashboardCluster: ManagerSettingsClusterId | undefined,
): boolean {
  if (item.dashboardCluster) {
    return managerTab === "dashboard" && dashboardCluster === item.dashboardCluster;
  }
  if (managerTab === "generator" && item.value === "generator") return true;
  if (managerTab === "blog-generator" && item.value === "generator") return true;
  if (managerTab === "sap-generator" && item.value === "generator") return true;
  if (managerTab === "free-flow" && item.value === "generator") return true;
  if (managerTab === "research" && item.value === "generator") return true;
  if (managerTab === "gsc-reporting" && item.value === "generator") return true;
  return managerTab === item.value;
}
