import type { WordPressSite } from "@/components/integrations/types";
import { normalizeCompetitorDomainKey } from "@/lib/competitor-research/competitor-domain-key";

/**
 * Synthetic WordPress site for SAP Generator Local analysis in temp-seed mode
 * (no Integrations connection). Used only for `siteId` / URL plumbing.
 */
export function buildTempLocalAnalysisSite(seedUrl: string): WordPressSite {
  const raw = seedUrl.trim();
  if (!raw) {
    return {
      id: "temp-local-analysis:empty",
      name: "Temp seed",
      siteUrl: "",
      username: "",
      appPassword: "",
      connectedAt: 0,
    };
  }
  const normalizedKey =
    normalizeCompetitorDomainKey(raw) ||
    raw.replace(/^https?:\/\//i, "").split("/")[0]?.replace(/[:/].*$/, "") ||
    "seed";
  let siteUrl = raw;
  if (!/^https?:\/\//i.test(siteUrl)) {
    siteUrl = `https://${siteUrl}`;
  }
  return {
    id: `temp-local-analysis:${normalizedKey}`,
    name: normalizedKey,
    siteUrl,
    username: "",
    appPassword: "",
    connectedAt: 0,
  };
}
