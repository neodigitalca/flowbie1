import { WORDPRESS_SITES_STORAGE_KEY, type WordPressSite } from "@/components/integrations/types";
import type { MasterInstructionSource } from "@/lib/master-instructions-storage";

export const PROFILE_BRAND_NAMING_FILENAME = "profile-brand-naming.txt";

export const KWB_BRAND_RULE_CONTENT = `[KWB brand naming]
preferred_public_names\tKWB Accountants & Advisors; KWB CPAs
discouraged_public_name\tKWB LLP
rule\tRefer to the firm as KWB Accountants & Advisors or KWB CPAs in client-facing copy, titles, meta descriptions, headings, FAQs, and first-party authority statements. Do not use KWB LLP unless quoting the legal entity name in formal compliance context.

[KWB office geography]
office_locations\tYellowknife; Red Deer; Edmonton; other locations
prohibited_framing\tDo not state or imply that KWB is located only in Edmonton or that Edmonton is the sole office.
rule\tKWB has offices and team members in multiple cities including Yellowknife, Red Deer, Edmonton, and other locations. Use multi-location or region-wide framing when describing where the firm operates. Do not default copy to Edmonton-based or located in Edmonton as if that were the only office unless the page topic is specifically about the Edmonton office.`;

export function isKwbSite(siteUrl: string, siteName: string): boolean {
  const hay = `${siteUrl} ${siteName}`.toLowerCase();
  return hay.includes("kwbllp") || /(^|[^a-z])kwb([^a-z]|$)/.test(hay);
}

function browserLocalStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage ?? null;
}

export function readStoredSite(siteId: string): WordPressSite | null {
  const storage = browserLocalStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(WORDPRESS_SITES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const row = parsed.find((s) => s && typeof s === "object" && (s as WordPressSite).id === siteId);
    return row ? (row as WordPressSite) : null;
  } catch {
    return null;
  }
}

export function kwbProfileBrandNamingSource(): MasterInstructionSource {
  return {
    name: PROFILE_BRAND_NAMING_FILENAME,
    content: KWB_BRAND_RULE_CONTENT,
    uploadedAt: Date.now(),
    kind: "semantic-triples",
  };
}

export function profileMasterRuleSourcesForSite(args: {
  siteId: string;
  siteUrl?: string;
  siteName?: string;
}): MasterInstructionSource[] {
  const stored = readStoredSite(args.siteId);
  const siteUrl = (args.siteUrl || stored?.siteUrl || stored?.productionSiteUrl || "").trim();
  const siteName = (args.siteName || stored?.name || "").trim();
  if (!isKwbSite(siteUrl, siteName)) return [];
  return [kwbProfileBrandNamingSource()];
}
