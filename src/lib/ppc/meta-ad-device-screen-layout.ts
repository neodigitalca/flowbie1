import { visualToolIsActive } from "@/lib/ppc/meta-ad-visual-tool-palette";
import type { MetaAdCreativeBrief } from "@/lib/ppc/meta-ads-types";

export type MetaAdDeviceScreenLayout =
  | "elementor_editor"
  | "wordpress_admin"
  | "published_homepage"
  | "published_service_page"
  | "neo_pulse_dashboard"
  | "none";

const VALID_LAYOUTS = new Set<MetaAdDeviceScreenLayout>([
  "elementor_editor",
  "wordpress_admin",
  "published_homepage",
  "published_service_page",
  "neo_pulse_dashboard",
  "none",
]);

const LAYOUT_ALIASES: Record<string, MetaAdDeviceScreenLayout> = {
  elementor: "elementor_editor",
  elementor_editor: "elementor_editor",
  wordpress: "wordpress_admin",
  wordpress_admin: "wordpress_admin",
  wp_admin: "wordpress_admin",
  homepage: "published_homepage",
  published_homepage: "published_homepage",
  service_page: "published_service_page",
  published_service_page: "published_service_page",
  "neo-pulse": "neo_pulse_dashboard",
  neo_pulse: "neo_pulse_dashboard",
  neo_pulse_dashboard: "neo_pulse_dashboard",
  none: "none",
};

export function parseMetaDeviceScreenLayout(raw: unknown): MetaAdDeviceScreenLayout {
  if (typeof raw !== "string") return "none";
  const key = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (VALID_LAYOUTS.has(key as MetaAdDeviceScreenLayout)) {
    return key as MetaAdDeviceScreenLayout;
  }
  return LAYOUT_ALIASES[key] ?? "none";
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

export function resolveMetaDeviceScreenLayout(
  brief: MetaAdCreativeBrief,
  options?: { focusKeyword?: string; pageContext?: string },
): MetaAdDeviceScreenLayout {
  const parsed = parseMetaDeviceScreenLayout(brief.deviceScreenLayout);
  if (parsed !== "none") return parsed;
  if (!visualToolIsActive(brief.visualToolPalette.device_screen)) return "none";

  const haystack = [
    options?.focusKeyword,
    options?.pageContext,
    brief.visualConcept,
    brief.referenceAdPattern,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    includesAny(haystack, [
      "neo-pulse",
      "action list",
      "search console",
      "gsc",
      "ad-01",
      "ad-04",
    ])
  ) {
    return "neo_pulse_dashboard";
  }
  if (
    includesAny(haystack, [
      "elementor",
      "page builder",
      "web design",
      "website design",
      "builder",
    ])
  ) {
    return "elementor_editor";
  }
  if (
    includesAny(haystack, [
      "wordpress admin",
      "wp admin",
      "cms workflow",
      "ad-02",
      "connected to wordpress",
    ])
  ) {
    return "wordpress_admin";
  }
  if (includesAny(haystack, ["service page", "services", "landing page"])) {
    return "published_service_page";
  }
  if (
    includesAny(haystack, [
      "homepage",
      "small business",
      "local business",
      "home page",
    ])
  ) {
    return "published_homepage";
  }
  return "none";
}

const LAYOUT_DESCRIPTIONS: Record<
  Exclude<MetaAdDeviceScreenLayout, "none">,
  string
> = {
  elementor_editor:
    "Elementor-style page builder: left widget panel, canvas with hero section, column blocks, image placeholders, and button blocks. Gray placeholder bars only on screen.",
  wordpress_admin:
    "WordPress admin UI: left sidebar with icon-only menu items, top admin bar, content editor with title field and block rows. Gray placeholder bars only on screen.",
  published_homepage:
    "Published website homepage in browser: nav bar, hero image block, three-column feature section, footer blocks. Gray placeholder bars only on screen.",
  published_service_page:
    "Published service landing page in browser: nav, hero, two-column content, testimonial row, CTA band. Gray placeholder bars only on screen.",
  neo_pulse_dashboard:
    "SaaS dashboard UI: sidebar nav icons, main panel with action-list rows and status chips. Gray placeholder bars only on screen.",
};

export const META_DEVICE_SCREEN_NO_READABLE_TEXT_RULE =
  "Device screens: no readable words, numbers, logos, or brand marks. Use gray placeholder bars and layout blocks only.";

export const META_DEVICE_SCREEN_HARDWARE_RULE =
  "Device hardware must be realistic: proper monitor stand or laptop hinge. Screen faces the viewer when the device is focal. Never office-chair bases or impossible mounts.";

export function buildMetaDeviceScreenLayoutBlock(layout: MetaAdDeviceScreenLayout): string | null {
  if (layout === "none") return null;
  const description = LAYOUT_DESCRIPTIONS[layout];
  return [
    "DEVICE SCREEN LAYOUT:",
    `- Style: ${description}`,
    `- ${META_DEVICE_SCREEN_NO_READABLE_TEXT_RULE}`,
    "- No abstract dashboards, holographic UI, neon wireframes, or chart-only screens.",
    `- ${META_DEVICE_SCREEN_HARDWARE_RULE}`,
  ].join("\n");
}
