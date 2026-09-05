import type { Location, NAPInfo, WordPressSite } from "@/components/integrations/types";
import { cityStateFromNapAddress } from "@/lib/llm-audit/resolve-site-location-label";
import {
  inferServiceCountry,
  isServiceCountry,
  normalizeServiceRegion,
  type ServiceCountry,
} from "@/lib/keyword-location-utils";

function preferredLocation(site?: WordPressSite | null): Location | undefined {
  const locs = site?.locations ?? site?.napInfo?.locations ?? [];
  return locs.find((loc) => loc.isDefault) ?? locs[0];
}

export function readSiteServiceCity(site?: WordPressSite | null): string {
  const preferred = preferredLocation(site);
  if (preferred?.city?.trim()) return preferred.city.trim();
  const napAddr = site?.napInfo?.address?.trim();
  if (napAddr) {
    const parsed = cityStateFromNapAddress(napAddr);
    if (parsed) return parsed.split(",")[0]?.trim() ?? "";
  }
  return "";
}

export function readSiteServiceState(site?: WordPressSite | null): string {
  const preferred = preferredLocation(site);
  const country = readSiteServiceCountry(site);
  if (preferred?.state?.trim()) return normalizeServiceRegion(preferred.state, country);
  const napAddr = site?.napInfo?.address?.trim();
  if (napAddr) {
    const parsed = cityStateFromNapAddress(napAddr);
    if (parsed.includes(",")) {
      return normalizeServiceRegion(parsed.split(",").slice(1).join(","), country);
    }
  }
  return "";
}

export function readSiteServiceCountry(site?: WordPressSite | null): ServiceCountry | "" {
  const preferred = preferredLocation(site);
  const stored = preferred?.country?.trim() ?? "";
  if (isServiceCountry(stored)) return stored;
  const state = preferred?.state?.trim() ?? "";
  if (state) return inferServiceCountry(state, stored);
  const napAddr = site?.napInfo?.address?.trim();
  if (napAddr) {
    const parsed = cityStateFromNapAddress(napAddr);
    if (parsed.includes(",")) {
      return inferServiceCountry(parsed.split(",").slice(1).join(","), stored);
    }
  }
  return inferServiceCountry("", stored);
}

export function buildSiteLocationsPatch(
  site: WordPressSite,
  city: string,
  state: string,
  country: string = "",
): Pick<WordPressSite, "locations" | "napInfo"> {
  const cityTrim = city.trim();
  const existing = preferredLocation(site);
  const countryTrim = country.trim();
  const resolvedCountry = isServiceCountry(countryTrim)
    ? countryTrim
    : inferServiceCountry(state, existing?.country);
  const resolvedState = normalizeServiceRegion(state, resolvedCountry);
  if (!cityTrim && !resolvedState && !resolvedCountry) {
    const emptyNap: NAPInfo | undefined = site.napInfo
      ? { ...site.napInfo, locations: [] }
      : undefined;
    return { locations: [], napInfo: emptyNap };
  }

  const loc: Location = {
    id: existing?.id ?? `loc-${site.id}-default`,
    name: existing?.name?.trim() || site.name || "Primary",
    address: existing?.address ?? "",
    city: cityTrim,
    state: resolvedState,
    country: resolvedCountry || undefined,
    zip: existing?.zip ?? "",
    phone: existing?.phone ?? site.napInfo?.phone ?? "",
    email: existing?.email,
    isDefault: true,
  };
  const locations = [loc];
  const napInfo: NAPInfo = site.napInfo
    ? { ...site.napInfo, locations }
    : {
        name: site.name,
        locations,
      };
  return { locations, napInfo };
}
