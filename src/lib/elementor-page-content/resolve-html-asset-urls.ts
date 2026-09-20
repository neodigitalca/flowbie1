function normalizeSiteOrigin(siteUrl: string): string {
  return siteUrl.replace(/\/+$/, "");
}

function resolveAssetUrl(value: string, origin: string): string {
  const trimmed = value.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed) || trimmed.startsWith("data:")) {
    return trimmed;
  }
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("/")) return `${origin}${trimmed}`;
  return `${origin}/${trimmed.replace(/^\/+/, "")}`;
}

/** Prefix relative src, srcset, and href values so images load in the app preview. */
export function resolveHtmlAssetUrls(html: string, siteUrl: string): string {
  const trimmed = html.trim();
  if (!trimmed || !siteUrl.trim()) return trimmed;
  const origin = normalizeSiteOrigin(siteUrl);

  let out = trimmed.replace(
    /\bsrc=(["'])([^"']+)\1/gi,
    (_match, quote: string, url: string) => `src=${quote}${resolveAssetUrl(url, origin)}${quote}`,
  );

  out = out.replace(
    /\bhref=(["'])([^"']+)\1/gi,
    (_match, quote: string, url: string) => {
      if (/^(#|mailto:|tel:|javascript:)/i.test(url.trim())) return `href=${quote}${url}${quote}`;
      return `href=${quote}${resolveAssetUrl(url, origin)}${quote}`;
    },
  );

  out = out.replace(/\bsrcset=(["'])([^"']+)\1/gi, (_match, quote: string, srcset: string) => {
    const resolved = srcset
      .split(",")
      .map((entry) => {
        const parts = entry.trim().split(/\s+/);
        if (!parts[0]) return entry.trim();
        parts[0] = resolveAssetUrl(parts[0], origin);
        return parts.join(" ");
      })
      .join(", ");
    return `srcset=${quote}${resolved}${quote}`;
  });

  return out;
}
