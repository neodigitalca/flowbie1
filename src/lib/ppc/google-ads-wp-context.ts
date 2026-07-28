import type { WordPressSite } from "@/components/integrations/types";
import {
  loadPpcPageBucketContext,
  resolvePpcAllowedLandingPages,
} from "@/lib/ppc/ppc-page-bucket-inventory";
import type { PpcWpPageContext } from "@/lib/ppc/google-ads-types";

export async function loadPpcGoogleWpContext(site: WordPressSite): Promise<PpcWpPageContext[]> {
  return loadPpcPageBucketContext(site);
}

export { resolvePpcAllowedLandingPages };
