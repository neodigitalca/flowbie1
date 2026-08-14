import type { LucideIcon } from "lucide-react";
import {
  Building2,
  UserRound,
  Users,
  Cloud,
  Crosshair,
  FlaskConical,
  GitMerge,
  Shield,
  Key,
  LayoutDashboard,
  LineChart,
  Layers,
  Megaphone,
  Mail,
  MessageCircle,
  CheckSquare,
  Share2,
  ScrollText,
  Search,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import type { ManagerSettingsClusterId } from "@/components/manager/manager-settings-cluster";
import { FLOWBIE_CA_DEPLOY } from "@/lib/flowbie-ca-deploy";

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
        description: "OpenRouter, DataForSEO, AgentMail",
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
        value: "dashboard-email-agent-admin",
        label: "Email Agent",
        description: "Inbound sender whitelist and blacklist",
        icon: Shield,
        dashboardCluster: "email-agent-admin",
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
    ],
  },
  {
    id: "communication",
    label: "Communication",
    icon: Mail,
    items: [
      {
        value: "communication",
        label: "Flo inbox",
        description: "AgentMail send/list - thread view lives under Properties → Email on each site",
        icon: Mail,
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
        description: "Opt, CSV, prompt, import, PR, entity, flow, and image",
        icon: TrendingUp,
      },
      {
        value: "gsc-reporting",
        label: "Report",
        description: "GSC MoM or API bundle, outline, section writers, stitched Markdown",
        icon: LineChart,
      },
      {
        value: "sitemap-optimizer",
        label: "Sitemap",
        description: "Cluster, merge, publish overlapping URLs, legacy redirects, and URL optimization",
        icon: GitMerge,
      },
      {
        value: "grid-local",
        label: "Grid Local",
        description: "Local pack rank grid scan via DataForSEO Maps SERP",
        icon: Crosshair,
      },
      {
        value: "vertical-benchmarks",
        label: "Industry verticals",
        description: "GSC top 10 per Flowbie property, bulk CSV packages",
        icon: Layers,
      },
      {
        value: "research",
        label: "Research",
        description: "Proposal, citation, and backlinking",
        icon: FlaskConical,
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

const FLOWBIE_CA_HIDDEN_SECTION_IDS = new Set(["communication"]);
const FLOWBIE_CA_HIDDEN_DASHBOARD_VALUES = new Set(["dashboard-email-agent-admin"]);

/** Nav sections for the active build (Communication hidden on flowbie.ca). */
export function getManagerNavSections(): ManagerNavSection[] {
  if (!FLOWBIE_CA_DEPLOY) {
    return MANAGER_NAV_SECTIONS;
  }
  return MANAGER_NAV_SECTIONS.filter((section) => !FLOWBIE_CA_HIDDEN_SECTION_IDS.has(section.id)).map(
    (section) => {
      if (section.id !== "dashboard") {
        return section;
      }
      return {
        ...section,
        items: section.items.filter((item) => !FLOWBIE_CA_HIDDEN_DASHBOARD_VALUES.has(item.value)),
      };
    },
  );
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
  if (managerTab === "research" && item.value === "research") return true;
  return managerTab === item.value;
}
