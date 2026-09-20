/**
 * Map a Pages row value to a Novamira page target.
 * Does not call WordPress URL / post / entity resolvers.
 */
export type ElementorPageTarget =
  | { kind: "front" }
  | { kind: "id"; pageId: number }
  | { kind: "slug"; slug: string };

function pathToSlug(path: string): string {
  let trimmed = path;
  while (trimmed.startsWith("/")) trimmed = trimmed.slice(1);
  while (trimmed.endsWith("/")) trimmed = trimmed.slice(0, -1);
  return trimmed;
}

export function elementorPageTargetFromInput(pageIdOrUrl: string, siteUrl = ""): ElementorPageTarget {
  const trimmed = pageIdOrUrl.trim();
  if (!trimmed || trimmed === "__front" || trimmed === "front" || trimmed === "/") {
    return { kind: "front" };
  }

  const asId = Number.parseInt(trimmed, 10);
  if (Number.isFinite(asId) && String(asId) === trimmed) {
    return { kind: "id", pageId: asId };
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    let path = "";
    let sameOriginHome = false;
    try {
      const page = new URL(trimmed);
      path = page.pathname;
      if (siteUrl) {
        const site = new URL(siteUrl);
        sameOriginHome = page.origin === site.origin && (path === "/" || path === "");
      }
    } catch {
      return { kind: "front" };
    }
    if (sameOriginHome || !path || path === "/") {
      return { kind: "front" };
    }
    const slug = pathToSlug(path);
    return slug ? { kind: "slug", slug } : { kind: "front" };
  }

  const slug = pathToSlug(trimmed);
  return slug ? { kind: "slug", slug } : { kind: "front" };
}
