/** Peer reuse is for AI featured images only. Google Image rows generate the Maps image. */
export function shouldPeerSearchFeaturedImage(args: {
  featuredImage?: string;
  useGoogleMaps: boolean;
  useAiImagePath: boolean;
  hasPeerSites: boolean;
}): boolean {
  if (args.featuredImage === "n") return false;
  if (args.useGoogleMaps) return false;
  return args.useAiImagePath && args.hasPeerSites;
}
